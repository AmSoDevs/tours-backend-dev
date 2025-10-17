import { Request, Response } from "express";
import { Data } from "../../models/Data";
import { Staff } from "../../models/Staff";
import { StaffAssignment } from "../../models/StaffAssignment";
import {
  generateUniqueProfileId,
  generateUniqueSlNo,
  resetStaffAssignmentIfNeeded,
  assignStaffForSingleRecord,
  assignStaffWithRotation,
  checkDuplicateNumbers,
} from "../../utils/helper";
import { FormTracking } from "../../models/FormTracking";
import { dataControllerHooks } from "./data.controller.hooks";

export const importData = async (req: Request, res: Response) => {
  try {
    const { dataType, data } = req.body;

    if (!dataType || !data || !Array.isArray(data)) {
      return res.status(400).json({
        success: false,
        message: "Invalid request data. dataType and data array are required.",
      });
    }

    const staffMembers = await Staff.find({
      isDeleted: false,
      isActive: true,
    }).select("_id");
    if (staffMembers.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No staff members available for data assignment.",
      });
    }

    const results = {
      totalRecords: data.length,
      importedRecords: 0,
      duplicateRecords: 0,
      skippedRecords: 0,
      errors: [] as string[],
    };

    const batchSize = 100;
    const batches = [];
    for (let i = 0; i < data.length; i += batchSize) {
      batches.push(data.slice(i, i + batchSize));
    }

    let staffAssignment = await StaffAssignment.findOne();
    if (!staffAssignment) {
      staffAssignment = new StaffAssignment({
        lastAssignedStaffId: null,
        totalAssignedRecords: 0,
      });
      await staffAssignment.save();
    }

    for (const batch of batches) {
      for (const record of batch) {
        try {
          const duplicateQuery: any[] = [];

          if (record.mobile) {
            duplicateQuery.push({ mobile: record.mobile });
            duplicateQuery.push({ refferenceNumber: record.mobile });
          }

          if (record.refferenceNumber) {
            duplicateQuery.push({ mobile: record.refferenceNumber });
            duplicateQuery.push({ refferenceNumber: record.refferenceNumber });
          }

          let existingRecord = null;
          if (duplicateQuery.length > 0) {
            existingRecord = await Data.findOne(
              record.data?.toLowerCase() === "visa"
                ? { $or: duplicateQuery } // 🔥 global check for visa
                : { $or: duplicateQuery, data: dataType } // check only within same data type
            );
          }

          if (existingRecord) {
            results.duplicateRecords++;
            continue; // skip duplicate
          }

          // assign staff
          const { assignedStaffId, staffAssignment: updatedStaffAssignment } =
            await assignStaffWithRotation(staffMembers);
          staffAssignment = updatedStaffAssignment;

          const slNo = await generateUniqueSlNo();
          const profileId = await generateUniqueProfileId();

          const newData = new Data({
            slNo,
            profileId,
            data: dataType,
            dataType: record?.dataType || "",
            verified: record.verified || "",
            mobile: record.mobile,
            name: record.name || "",
            remarkFirst: record.remarkFirst || "",
            refferenceNumber: record.refferenceNumber || "",
            refferenceName: record.refferenceName || "",
            remarkSecond: record.remarkSecond || "",
            assignedStaff: assignedStaffId,
          });

          await newData.save();
          results.importedRecords++;
        } catch (error: any) {
          console.error("Error processing record:", record, error);
          results.errors.push(
            `Error processing record ${record.mobile || "N/A"}: ${
              error.message
            }`
          );
        }
      }
    }

    return res.status(200).json({
      success: true,
      message: "Data import completed successfully",
      results,
    });
  } catch (error: any) {
    console.error("Error importing data:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error during data import",
      error: error.message,
    });
  }
};

export const getData = async (req: Request, res: Response) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    const dataType = String(req.query.dataType || "");
    const staffId = String(req.query.staffId || "");
    const status = String(req.query.status || "");
    const dataFilter = String(req.query.data || "");
    const search = String(req.query.search || "");
    const sortBy = String(req.query.sortBy || "createdAt");
    const sortOrder = String(req.query.sortOrder || "desc");
    const showDeletedOnly = String(req.query.showDeletedOnly || "false");
    const showWithRemindersOnly = String(
      req.query.showWithRemindersOnly || "false"
    );
    const type = String(req.query.type || "all");
    const startDate = req.query.startDate ? String(req.query.startDate) : "";
    const endDate = req.query.endDate ? String(req.query.endDate) : "";

    const query: any = {};
    query.isDeleted = showDeletedOnly === "true";

    if (showWithRemindersOnly === "true")
      query.reminderDateAndTime = { $ne: null };

    if (dataType && dataType !== "all")
      query.dataType = { $regex: dataType, $options: "i" };

    if (staffId && staffId !== "all") query.assignedStaff = staffId;

    if (status && status !== "all")
      query.status = { $regex: status, $options: "i" };

    // ✅ Simplify dataFilter — handle both bulk and register properly
    if (dataFilter && dataFilter !== "all") {
      query.data = { $regex: dataFilter, $options: "i" };
    }

    // ✅ Search logic
    if (search && search !== "") {
      const searchRegex = { $regex: search, $options: "i" };
      query.$or = [
        { name: searchRegex },
        { mobile: searchRegex },
        { remarkFirst: searchRegex },
        { remarkSecond: searchRegex },
        { refferenceName: searchRegex },
        { refferenceNumber: searchRegex },
        { slNo: searchRegex },
      ];
    }

    // ✅ Date range filter - apply only if valid date(s) are given
    const isValidDate = (d: string) => !isNaN(new Date(d).getTime());

    if (isValidDate(startDate) || isValidDate(endDate)) {
      const dateFilter: any = {};
      if (isValidDate(startDate)) dateFilter.$gte = new Date(startDate);
      if (isValidDate(endDate))
        dateFilter.$lte = new Date(new Date(endDate).setHours(23, 59, 59, 999));
      query.createdAt = dateFilter;
    }

    // ✅ Sorting logic
    const sortObj: any = {};
    const sortFieldMap: any = {
      createdAt: "createdAt",
      updatedAt: "updatedAt",
      name: "name",
      mobile: "mobile",
      status: "status",
      slNo: "slNo",
      "assignedStaff.staffId": "assignedStaff.staffId",
    };
    const field = sortFieldMap[sortBy] || "createdAt";
    sortObj[field] = sortOrder === "desc" ? -1 : 1;

    const skip = (Number(page) - 1) * Number(limit || 0);

    // ✅ Fetch initial records
    const data = await Data.find(query)
      .populate("assignedStaff", "name staffId")
      .populate("files")
      .sort(sortObj)
      .skip(skip)
      .limit(limit ? Number(limit) : 0);

    const total = await Data.countDocuments(query);
    const pagination = {
      currentPage: Number(page),
      totalPages: limit ? Math.ceil(total / Number(limit)) : 1,
      totalRecords: total,
      limit: Number(limit) || total,
    };

    // ✅ Compute relationship flags (for both bulk and register)
    const updatedData = await Promise.all(
      data.map(async (record: any) => {
        const dataType = record.data?.toLowerCase() || "";
        const isBulk = dataType === "bulk";
        const isRegister = dataType === "register";

        const mobile = String(record.mobile || "").trim();
        const referenceNumber = String(record.refferenceNumber || "").trim();

        let isReferenceRegistered = false;
        let isBulkRegistered = false;

        // 🔹 For all record types, check if the reference is registered
        if (referenceNumber) {
          const registeredRef = await Data.findOne({
            $or: [
              { mobile: referenceNumber },
              { refferenceNumber: referenceNumber },
            ],
            data: "register",
            isDeleted: false,
          });
          if (registeredRef) isReferenceRegistered = true;
        }

        // 🔹 For all record types, check if this number is self-registered
        if (mobile) {
          const selfRegistered = await Data.findOne({
            $or: [{ mobile }, { refferenceNumber: mobile }],
            data: "register",
            isDeleted: false,
          });
          if (selfRegistered) isBulkRegistered = true;
        }

        return {
          ...record.toObject(),
          isBulk,
          isRegister,
          isReferenceRegistered,
          isBulkRegistered,
        };
      })
    );

    // ✅ Combined filter logic (status + type)
    let filteredData = updatedData;

    if (status && status.toLowerCase() !== "all") {
      filteredData = updatedData.filter((r) => {
        const matchesStatus = r.status?.toLowerCase() === status.toLowerCase();

        // Apply additional logic only for bulk
        if (r.isBulk && status.toLowerCase() === "success") {
          return (
            matchesStatus && !(r.isReferenceRegistered && r.isBulkRegistered)
          );
        }

        // For register or others, just match by status
        return matchesStatus;
      });
    }

    // ✅ Filter type (new / old) — only for bulk records
    if (type === "old") {
      filteredData = updatedData.filter(
        (r) => r.isBulk && r.isReferenceRegistered && !r.isBulkRegistered
      );
    } else if (type === "new") {
      filteredData = updatedData.filter(
        (r) => r.isBulk && !r.isReferenceRegistered && !r.isBulkRegistered
      );
    }

    return res.status(200).json({
      success: true,
      data: filteredData,
      pagination,
    });
  } catch (error: any) {
    console.error("Error fetching data:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error while fetching data",
      error: error.message,
    });
  }
};

export const updateDataStatus = async (req: Request, res: Response) => {
  try {
    const { ids, status, reminderDateAndTime } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid request. IDs array is required.",
      });
    }

    if (!status) {
      return res.status(400).json({
        success: false,
        message: "Status is required.",
      });
    }

    const recordsWithReminders = await Data.find({
      _id: { $in: ids },
      reminderDateAndTime: { $ne: null },
    });

    const recordWithoutReminders = await Data.find({
      _id: { $in: ids },
      $or: [
        { reminderDateAndTime: { $eq: null } },
        { reminderDateAndTime: { $exists: false } },
      ],
    });

    const updateDataWithReminders: any = {
      status: status,
      reminderDateAndTime: "",
    };

    const updateDataWithoutReminders: any = {
      status: status,
      reminderDateAndTime: new Date(reminderDateAndTime),
    };

    if (recordsWithReminders?.length) {
      const ids = recordsWithReminders.map((record) => record._id);
      const updateResult = await Data.updateMany(
        {
          _id: { $in: ids },
        },
        {
          $set: updateDataWithReminders,
        }
      );
    }

    if (recordWithoutReminders?.length) {
      const ids = recordWithoutReminders.map((record) => record._id);
      const updateResult = await Data.updateMany(
        {
          _id: { $in: ids },
        },
        {
          $set: updateDataWithoutReminders,
        }
      );
    }

    // if (updateResult.modifiedCount === 0) {
    //   return res.status(404).json({
    //     success: false,
    //     message: "No records found to update.",
    //   });
    // }

    return res.status(200).json({
      success: true,
      message: `Successfully updated  record(s)`,
      updatedCount: 0,
    });
  } catch (error: any) {
    console.error("Error updating data status:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error while updating status",
      error: error.message,
    });
  }
};

export const updateCallClickTime = async (req: Request, res: Response) => {
  try {
    const { id, refference } = req.body;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Record ID is required.",
      });
    }

    const updateResult = await Data.findByIdAndUpdate(
      id,
      {
        $set: {
          [refference ? "refferenceCallClickTime" : "callClickTime"]:
            new Date(),
        },
      },
      { new: true }
    );

    if (!updateResult) {
      return res.status(404).json({
        success: false,
        message: "Record not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Call click time updated successfully",
      data: updateResult,
    });
  } catch (error: any) {
    console.error("Error updating call click time:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error while updating call click time",
      error: error.message,
    });
  }
};

export const updateWhatsappClickTime = async (req: Request, res: Response) => {
  try {
    const { id, refference } = req.body;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Record ID is required.",
      });
    }

    const updateResult = await Data.findByIdAndUpdate(
      id,
      {
        $set: {
          [refference ? "refferenceWhatsappClickTime" : "whatsappClickTime"]:
            new Date(),
        },
      },
      { new: true }
    );

    if (!updateResult) {
      return res.status(404).json({
        success: false,
        message: "Record not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "WhatsApp click time updated successfully",
      data: updateResult,
    });
  } catch (error: any) {
    console.error("Error updating WhatsApp click time:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error while updating WhatsApp click time",
      error: error.message,
    });
  }
};

export const updateRemarks = async (req: Request, res: Response) => {
  try {
    const { id, remarkFirst, remarkSecond } = req.body;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Record ID is required.",
      });
    }

    const updateData: any = {};
    if (remarkFirst !== undefined) updateData.remarkFirst = remarkFirst;
    if (remarkSecond !== undefined) updateData.remarkSecond = remarkSecond;

    const updateResult = await Data.findByIdAndUpdate(
      id,
      {
        $set: updateData,
      },
      { new: true }
    );

    if (!updateResult) {
      return res.status(404).json({
        success: false,
        message: "Record not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Remarks updated successfully",
      data: updateResult,
    });
  } catch (error: any) {
    console.error("Error updating remarks:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error while updating remarks",
      error: error.message,
    });
  }
};

export const submitForm = async (req: Request, res: Response) => {
  try {
    const {
      name,
      mobile,
      whatsapp,
      altMobNumber,
      preferCountry,
      preferJobs,
      job,
      searchedHouses,
      gender,
      dateOfBirth,
      maritalStatus,
      religion,
      education,
      jobType,
      monthlyIncome,
      spokenLanguage,
      district,
      city,
      expectations,
      createProfileFor,
      contactPersonName,
      trackingId,
      // 🆕 Newly added
      lookingFor,
      star,
      typeOfJathakam,
    } = req.body;

    if (!name || !mobile) {
      return res.status(400).json({
        success: false,
        message: "Name and mobile number are required.",
      });
    }

    const form = await FormTracking.findOne({ trackingId });
    if (!form) {
      return res.status(400).json({
        success: false,
        message: "Invalid form ID",
      });
    }

    const isMultipleAllowed = form.allowMultiple === true;

    // ✅ Duplicate check
    if (!isMultipleAllowed) {
      const duplicateRecord = await checkDuplicateNumbers(
        { mobile, whatsapp, altMobNumber },
        form.formType
      );
      if (duplicateRecord && form.status === "shared") {
        return res.status(400).json({
          success: false,
          message:
            "One of the numbers (mobile / WhatsApp / alternate) already exists in another record.",
        });
      }
    }

    // ✅ Staff assignment
    let assignedStaff: any;
    let staffAssignment: any;

    if (form.staffId) {
      assignedStaff = form.staffId;
    } else {
      const staffMembers = await Staff.find({
        isDeleted: false,
        isActive: true,
      }).select("_id");

      if (staffMembers.length === 0) {
        return res.status(400).json({
          success: false,
          message: "No staff members available for data assignment.",
        });
      }

      const { assignedStaffId, staffAssignment: updatedStaffAssignment } =
        await assignStaffForSingleRecord(staffMembers);
      assignedStaff = assignedStaffId;
      staffAssignment = updatedStaffAssignment;
    }

    const slNo = await generateUniqueSlNo();
    const profileId =
      await dataControllerHooks.createRegistrationUniqueSerialNumber(
        form.formType
      );

    const newData = new Data({
      slNo,
      profileId,
      data: form.formType,
      dataType: "self",
      name,
      mobile,
      whatsapp,
      altMobNumber,
      preferCountry,
      preferJobs,
      job,
      searchedHouses,
      gender,
      dateOfBirth,
      maritalStatus,
      religion,
      education,
      jobType,
      monthlyIncome,
      spokenLanguage,
      district,
      city,
      expectations,
      createProfileFor,
      contactPersonName,
      houseType: req.body.houseType,
      priceRange: req.body.priceRange,
      prefferedPlace: req.body.prefferedPlace,
      caste: req.body.caste,
      passportNo: req.body.passportNo,
      aadharId: req.body.aadharId,
      prefferedSalary: req.body.prefferedSalary,
      visaType: req.body.visaType,
      prefferedCourse: req.body.prefferedCourse,
      // 🆕 Newly added fields
      lookingFor,
      star,
      typeOfJathakam,
      assignedStaff,
      isDeleted: false,
    });

    await newData.save();

    if (!isMultipleAllowed) {
      form.status = "in_progress";
      form.dataId = newData._id;
      form.currentStep = 1;
      if (!form.staffId) form.staffId = assignedStaff;
      await form.save();
    } else {
      form.status = "in_progress";
      form.currentStep = 1;
      await form.save();
    }

    return res.status(201).json({
      success: true,
      message: isMultipleAllowed
        ? "New form entry created successfully (multiple allowed)"
        : "Form submitted successfully",
      data: newData,
    });
  } catch (error: any) {
    console.error("Error submitting form:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error while submitting form",
      error: error.message,
    });
  }
};


export const updateForm = async (req: Request, res: Response) => {
  try {
    const {
      trackingId,
      name,
      mobile,
      whatsapp,
      altMobNumber,
      preferCountry,
      preferJobs,
      job,
      searchedHouses,
      gender,
      dateOfBirth,
      maritalStatus,
      religion,
      education,
      jobType,
      monthlyIncome,
      spokenLanguage,
      district,
      city,
      expectations,
      createProfileFor,
      contactPersonName,
      step,
      status,
      profilePhoto,
      // 🆕 Newly added
      lookingFor,
      star,
      typeOfJathakam,
    } = req.body;

    if (!trackingId) {
      return res.status(400).json({
        success: false,
        message: "Tracking ID is required.",
      });
    }

    const form = await FormTracking.findOne({ trackingId });
    if (!form) {
      return res.status(400).json({
        success: false,
        message: "Invalid form tracking ID.",
      });
    }

    const allowMultiple = form.allowMultiple || false;
    let recordToUpdate = null;

    if (!allowMultiple && form.dataId) {
      recordToUpdate = await Data.findById(form.dataId);
    }

    if (allowMultiple) {
      recordToUpdate = await Data.findOne({
        $and: [{ mobile: mobile }, { data: form.formType }],
      });
    }

    const duplicateRecord = await checkDuplicateNumbers(
      { mobile, whatsapp, altMobNumber },
      form.formType,
      recordToUpdate?._id?.toString()
    );

    if (duplicateRecord) {
      return res.status(400).json({
        success: false,
        message:
          "One of the numbers (mobile / WhatsApp / alternate) already exists in another record.",
      });
    }

    if (!recordToUpdate && allowMultiple) {
      const newData = new Data({
        name,
        mobile,
        whatsapp,
        altMobNumber,
        preferCountry,
        preferJobs,
        job,
        searchedHouses,
        gender,
        dateOfBirth,
        maritalStatus,
        religion,
        education,
        jobType,
        monthlyIncome,
        spokenLanguage,
        district,
        city,
        expectations,
        createProfileFor,
        contactPersonName,
        profilePhoto,
        data: form.formType,
        refferenceNumber: mobile,
        // 🆕 Newly added
        lookingFor,
        star,
        typeOfJathakam,
      });

      await newData.save();

      if (!allowMultiple) {
        form.dataId = newData._id;
        form.status = "in_progress";
        await form.save();
      }

      return res.status(200).json({
        success: true,
        message: "New record created successfully (multiple mode).",
        data: newData,
      });
    }

    if (!recordToUpdate) {
      return res.status(404).json({
        success: false,
        message:
          "No existing record found to update. Please submit the form first.",
      });
    }

    const updateFields: Record<string, any> = {
      name,
      mobile,
      whatsapp,
      altMobNumber,
      preferCountry,
      preferJobs,
      job,
      searchedHouses,
      gender,
      dateOfBirth,
      maritalStatus,
      religion,
      education,
      jobType,
      monthlyIncome,
      spokenLanguage,
      district,
      city,
      expectations,
      createProfileFor,
      contactPersonName,
      profilePhoto,
      status,
      // 🆕 Added
      lookingFor,
      star,
      typeOfJathakam,
    };

    Object.keys(updateFields).forEach((k) => {
      if (updateFields[k] === undefined) delete updateFields[k];
    });

    const updatedRecord = await Data.findByIdAndUpdate(
      recordToUpdate._id,
      { $set: updateFields },
      { new: true, runValidators: true }
    );

    if (step !== undefined) form.currentStep = step;
    if (step === 3) form.status = "submitted";
    if (!allowMultiple) await form.save();

    return res.status(200).json({
      success: true,
      message: "Form updated successfully",
      data: updatedRecord,
    });
  } catch (error: any) {
    console.error("Error in updateForm:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error while updating form",
      error: error.message,
    });
  }
};


export const updateRow = async (req: Request, res: Response) => {
  try {
    const {
      id,
      mobile,
      whatsapp,
      altMobNumber,
      name,
      status,
      remarkFirst,
      remarkSecond,
      verified,
      dataType,
      refferenceNumber,
      refferenceName,
      regPayment,
      serPayment,
      contactPersonName,
      regReceived,
      serReceived,
      regBalance,
      serBalance,
      passportNo,
      vSampleSend,
      expectations,
      district,
      education,
      preferCountry,
      city,
      jobType,
      preferJobs,
      religion,
      monthlyIncome,
      searchedHouses,
      maritalStatus,
      spokenLanguage,
      processing,
      serDate,
      caste,
      job,
      visaType,
      houseType,
      typeOfJathakam,
      star,
      lookingFor,
      prefferedPlace,
      prefferedSalary,
      prefferedCourse,
      priceRange,
      dateOfBirth,
      profilePhoto,
      aadharId,
      createProfileFor,
    } = req.body;

    if (!id)
      return res.status(400).json({ success: false, message: "Record ID is required" });

    const existingRecord = await Data.findById(id);
    if (!existingRecord)
      return res.status(404).json({ success: false, message: "Record not found" });

    // ✅ Full duplicate check (4 fields)
    const hasChanged =
      (mobile && mobile !== existingRecord.mobile) ||
      (whatsapp && whatsapp !== existingRecord.whatsapp) ||
      (altMobNumber && altMobNumber !== existingRecord.altMobNumber) ||
      (refferenceNumber && refferenceNumber !== existingRecord.refferenceNumber);

    if (hasChanged) {
      const numbersToCheck = [mobile, whatsapp, altMobNumber, refferenceNumber].filter(Boolean);
      const uniqueNumbers = new Set(numbersToCheck);
      if (uniqueNumbers.size !== numbersToCheck.length) {
        return res.status(400).json({
          success: false,
          message: "Mobile, WhatsApp, Alternate, and Reference numbers cannot be identical.",
        });
      }

      const duplicateCheckQuery: any = { _id: { $ne: id }, $or: [] };
      const isVisaType = existingRecord.data?.toLowerCase() === "visa";
      if (!isVisaType) duplicateCheckQuery.data = existingRecord.data;

      numbersToCheck.forEach((num) => {
        duplicateCheckQuery.$or.push(
          { mobile: num },
          { whatsapp: num },
          { altMobNumber: num },
          { refferenceNumber: num }
        );
      });

      const duplicateRecord = await Data.findOne(duplicateCheckQuery);
      if (duplicateRecord) {
        return res.status(400).json({
          success: false,
          message:
            "One of the numbers (Mobile / WhatsApp / Alternate / Reference) already exists in another record.",
        });
      }
    }

    // ✅ Prepare update fields
    const updateFields = {
      mobile,
      whatsapp,
      altMobNumber,
      name,
      status,
      remarkFirst,
      remarkSecond,
      verified,
      dataType,
      refferenceNumber,
      refferenceName,
      regPayment,
      serPayment,
      contactPersonName,
      regReceived,
      serReceived,
      regBalance,
      serBalance,
      passportNo,
      vSampleSend,
      expectations,
      district,
      education,
      preferCountry,
      city,
      jobType,
      preferJobs,
      religion,
      monthlyIncome,
      searchedHouses,
      maritalStatus,
      spokenLanguage,
      processing,
      serDate,
      caste,
      job,
      visaType,
      houseType,
      typeOfJathakam,
      star,
      lookingFor,
      prefferedPlace,
      prefferedSalary,
      prefferedCourse,
      priceRange,
      dateOfBirth,
      profilePhoto,
      aadharId,
      createProfileFor,
    };

    const updatedRecord = await Data.findByIdAndUpdate(id, updateFields, {
      new: true,
      runValidators: true,
    });

    return res.status(200).json({
      success: true,
      message: "Record updated successfully",
      data: updatedRecord,
    });
  } catch (error: any) {
    console.error("❌ Error updating row:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Error updating record",
    });
  }
};


export const getStaffAssignedData = async (req: Request, res: Response) => {
  try {
    const { id: staffId } = req.params;

    // 🔹 Safely cast all query params to string
    const page = Number(req.query.page) || 1;
    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    const dataType = String(req.query.dataType || "");
    const status = String(req.query.status || "");
    const dataFilter = String(req.query.data || "");
    const search = String(req.query.search || "");
    const sortBy = String(req.query.sortBy || "createdAt");
    const sortOrder = String(req.query.sortOrder || "desc");
    const startDate = String(req.query.startDate || "");
    const endDate = String(req.query.endDate || "");
    const type = String(req.query.type || "all");

    const query: any = {
      isDeleted: false,
      assignedStaff: staffId,
    };

    // 🔹 Apply filters
    if (dataType && dataType !== "all") {
      query.dataType = { $regex: dataType, $options: "i" };
    }

    if (status && status !== "all") {
      query.status = { $regex: status, $options: "i" };
    }

    if (dataFilter && dataFilter !== "all") {
      query.data = { $regex: dataFilter, $options: "i" };
    }

    // 🔹 Date range filter
    const isValidDate = (d: string): boolean =>
      !!d && !isNaN(new Date(d).getTime());
    if (isValidDate(startDate) || isValidDate(endDate)) {
      const dateFilter: any = {};
      if (isValidDate(startDate)) dateFilter.$gte = new Date(startDate);
      if (isValidDate(endDate))
        dateFilter.$lte = new Date(new Date(endDate).setHours(23, 59, 59, 999));
      query.createdAt = dateFilter;
    }

    // 🔹 Search logic
    if (search && search !== "") {
      const searchRegex = { $regex: search, $options: "i" };
      query.$or = [
        { name: searchRegex },
        { mobile: searchRegex },
        { remarkFirst: searchRegex },
        { remarkSecond: searchRegex },
        { refferenceName: searchRegex },
        { refferenceNumber: searchRegex },
        { slNo: searchRegex },
      ];
    }

    // 🔹 Sorting
    const sortObj: any = {};
    const sortFieldMap: any = {
      createdAt: "createdAt",
      updatedAt: "updatedAt",
      name: "name",
      mobile: "mobile",
      status: "status",
      slNo: "slNo",
      "assignedStaff.staffId": "assignedStaff.staffId",
    };
    const field = sortFieldMap[sortBy] || "createdAt";
    sortObj[field] = sortOrder === "desc" ? -1 : 1;

    // 🔹 Pagination
    const skip = (page - 1) * (limit || 0);

    const data = await Data.find(query)
      .populate("assignedStaff", "name staffId")
      .sort(sortObj)
      .skip(skip)
      .limit(limit ? limit : 0);

    const total = await Data.countDocuments(query);
    const pagination = {
      currentPage: page,
      totalPages: limit ? Math.ceil(total / limit) : 1,
      totalRecords: total,
      limit: limit || total,
    };

    // 🔹 Add flags: isBulk, isRegister, isReferenceRegistered, isBulkRegistered
    const updatedData = await Promise.all(
      data.map(async (record: any) => {
        const dataType = record.data?.toLowerCase() || "";
        const isBulk = dataType === "bulk";
        const isRegister = dataType === "register";

        const mobile = String(record.mobile || "").trim();
        const referenceNumber = String(record.refferenceNumber || "").trim();

        let isReferenceRegistered = false;
        let isBulkRegistered = false;

        if (referenceNumber) {
          const registeredRef = await Data.findOne({
            $or: [
              { mobile: referenceNumber },
              { refferenceNumber: referenceNumber },
            ],
            data: "register",
            isDeleted: false,
          });
          if (registeredRef) isReferenceRegistered = true;
        }

        if (mobile) {
          const selfRegistered = await Data.findOne({
            $or: [{ mobile }, { refferenceNumber: mobile }],
            data: "register",
            isDeleted: false,
          });
          if (selfRegistered) isBulkRegistered = true;
        }

        return {
          ...record.toObject(),
          isBulk,
          isRegister,
          isReferenceRegistered,
          isBulkRegistered,
        };
      })
    );

    // 🔹 Apply type filter logic (new/old)
    let filteredData = updatedData;
    if (type === "old") {
      filteredData = updatedData.filter(
        (r) => r.isBulk && r.isReferenceRegistered && !r.isBulkRegistered
      );
    } else if (type === "new") {
      filteredData = updatedData.filter(
        (r) => r.isBulk && !r.isReferenceRegistered && !r.isBulkRegistered
      );
    }

    // 🔹 Status filter (apply last to include flags)
    if (status && status.toLowerCase() !== "all") {
      filteredData = filteredData.filter(
        (r) => r.status?.toLowerCase() === status.toLowerCase()
      );
    }

    return res.status(200).json({
      success: true,
      data: filteredData,
      pagination,
    });
  } catch (error: any) {
    console.error("Error fetching staff assigned data:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error while fetching staff assigned data",
      error: error.message,
    });
  }
};

// Staff-specific update functions that verify data ownership
export const updateStaffDataStatus = async (req: Request, res: Response) => {
  try {
    const { id: staffId } = req.params;
    const { ids, status, reminderDateAndTime } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid request. IDs array is required.",
      });
    }

    if (!status) {
      return res.status(400).json({
        success: false,
        message: "Status is required.",
      });
    }

    // Verify that all records belong to the staff member
    const records = await Data.find({
      _id: { $in: ids },
      assignedStaff: staffId,
      isDeleted: false,
    });

    if (records.length !== ids.length) {
      return res.status(403).json({
        success: false,
        message: "Some records are not assigned to you or do not exist.",
      });
    }

    // Prepare update object
    const updateData: any = {
      status: status,
    };

    // Add reminderDateAndTime if provided
    if (reminderDateAndTime) {
      updateData.reminderDateAndTime = new Date(reminderDateAndTime);
    }

    // Update only the verified records
    const updateResult = await Data.updateMany(
      {
        _id: { $in: ids },
        assignedStaff: staffId,
        isDeleted: false,
      },
      {
        $set: updateData,
      }
    );

    if (updateResult.modifiedCount === 0) {
      return res.status(404).json({
        success: false,
        message: "No records found to update.",
      });
    }

    return res.status(200).json({
      success: true,
      message: `Successfully updated ${updateResult.modifiedCount} record(s)`,
      updatedCount: updateResult.modifiedCount,
    });
  } catch (error: any) {
    console.error("Error updating staff data status:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error while updating status",
      error: error.message,
    });
  }
};

export const updateStaffCallClickTime = async (req: Request, res: Response) => {
  try {
    const { id: staffId } = req.params;
    const { id, refference } = req.body;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Record ID is required.",
      });
    }

    // Verify that the record belongs to the staff member
    const record = await Data.findOne({
      _id: id,
      assignedStaff: staffId,
      isDeleted: false,
    });

    if (!record) {
      return res.status(403).json({
        success: false,
        message: "Record not found or not assigned to you.",
      });
    }

    const updateResult = await Data.findByIdAndUpdate(
      id,
      {
        $set: {
          [refference ? "refferenceCallClickTime" : "callClickTime"]:
            new Date(),
        },
      },
      { new: true }
    );

    return res.status(200).json({
      success: true,
      message: "Call click time updated successfully",
      data: updateResult,
    });
  } catch (error: any) {
    console.error("Error updating staff call click time:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error while updating call click time",
      error: error.message,
    });
  }
};

export const updateStaffWhatsappClickTime = async (
  req: Request,
  res: Response
) => {
  try {
    const { id: staffId } = req.params;
    const { id, refference } = req.body;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Record ID is required.",
      });
    }

    // Verify that the record belongs to the staff member
    const record = await Data.findOne({
      _id: id,
      assignedStaff: staffId,
      isDeleted: false,
    });

    if (!record) {
      return res.status(403).json({
        success: false,
        message: "Record not found or not assigned to you.",
      });
    }

    const updateResult = await Data.findByIdAndUpdate(
      id,
      {
        $set: {
          [refference ? "refferenceWhatsappClickTime" : "whatsappClickTime"]:
            new Date(),
        },
      },
      { new: true }
    );

    return res.status(200).json({
      success: true,
      message: "WhatsApp click time updated successfully",
      data: updateResult,
    });
  } catch (error: any) {
    console.error("Error updating staff WhatsApp click time:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error while updating WhatsApp click time",
      error: error.message,
    });
  }
};

export const updateStaffRemarks = async (req: Request, res: Response) => {
  try {
    const { id: staffId } = req.params;
    const { id, remarkFirst, remarkSecond } = req.body;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Record ID is required.",
      });
    }

    // Verify that the record belongs to the staff member
    const record = await Data.findOne({
      _id: id,
      assignedStaff: staffId,
      isDeleted: false,
    });

    if (!record) {
      return res.status(403).json({
        success: false,
        message: "Record not found or not assigned to you.",
      });
    }

    const updateData: any = {};
    if (remarkFirst !== undefined) updateData.remarkFirst = remarkFirst;
    if (remarkSecond !== undefined) updateData.remarkSecond = remarkSecond;

    const updateResult = await Data.findByIdAndUpdate(
      id,
      {
        $set: updateData,
      },
      { new: true }
    );

    return res.status(200).json({
      success: true,
      message: "Remarks updated successfully",
      data: updateResult,
    });
  } catch (error: any) {
    console.error("Error updating staff remarks:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error while updating remarks",
      error: error.message,
    });
  }
};

// Reset staff assignment rotation (useful when staff changes occur)
export const resetStaffAssignment = async (req: Request, res: Response) => {
  try {
    const staffAssignment = await StaffAssignment.findOne();

    if (!staffAssignment) {
      return res.status(404).json({
        success: false,
        message: "Staff assignment tracking not found.",
      });
    }

    // Use the helper function to reset
    await resetStaffAssignmentIfNeeded();

    // Get updated assignment for response
    const updatedAssignment = await StaffAssignment.findOne();

    return res.status(200).json({
      success: true,
      message:
        "Staff assignment rotation has been reset. Next import will start from the first staff member.",
      data: {
        lastAssignedStaffId: updatedAssignment?.lastAssignedStaffId || null,
        totalAssignedRecords: updatedAssignment?.totalAssignedRecords || 0,
      },
    });
  } catch (error: any) {
    console.error("Error resetting staff assignment:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error while resetting staff assignment",
      error: error.message,
    });
  }
};

// Get current staff assignment status
export const getStaffAssignmentStatus = async (req: Request, res: Response) => {
  try {
    const staffMembers = await Staff.find({
      isDeleted: false,
      isActive: true,
    }).select("_id name staffId");

    const staffAssignment = await StaffAssignment.findOne();

    if (!staffAssignment) {
      return res.status(200).json({
        success: true,
        message:
          "No staff assignment tracking found. Will be created on next import.",
        data: {
          staffMembers: staffMembers.length,
          lastAssignedStaffId: null,
          totalAssignedRecords: 0,
          nextStaffToReceive:
            staffMembers.length > 0
              ? staffMembers[0].name
              : "No staff available",
        },
      });
    }

    // Find the index of the last assigned staff in the current active staff array
    let lastAssignedStaffIndex = -1;
    if (staffAssignment.lastAssignedStaffId) {
      lastAssignedStaffIndex = staffMembers.findIndex(
        (staff) => staff._id.toString() === staffAssignment.lastAssignedStaffId
      );
    }

    const nextStaffIndex = (lastAssignedStaffIndex + 1) % staffMembers.length;
    const nextStaff = staffMembers[nextStaffIndex];

    return res.status(200).json({
      success: true,
      data: {
        staffMembers: staffMembers.length,
        lastAssignedStaffId: staffAssignment.lastAssignedStaffId,
        lastAssignedStaffIndex: lastAssignedStaffIndex,
        totalAssignedRecords: staffAssignment.totalAssignedRecords,
        nextStaffToReceive: nextStaff ? nextStaff.name : "No staff available",
        staffList: staffMembers.map((staff, index) => ({
          index,
          name: staff.name,
          staffId: staff.staffId,
          isNext: index === nextStaffIndex,
        })),
      },
    });
  } catch (error: any) {
    console.error("Error getting staff assignment status:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error while getting staff assignment status",
      error: error.message,
    });
  }
};

export const updateStaffRow = async (req: Request, res: Response) => {
  try {
    const { id: staffId } = req.params;
    const {
      id,
      mobile,
      whatsapp,
      altMobNumber,
      name,
      status,
      remarkFirst,
      remarkSecond,
      verified,
      dataType,
      refferenceNumber,
      refferenceName,
      regPayment,
      serPayment,
      contactPersonName,
      regReceived,
      serReceived,
      regBalance,
      serBalance,
      passportNo,
      vSampleSend,
      expectations,
      district,
      education,
      preferCountry,
      city,
      jobType,
      preferJobs,
      religion,
      monthlyIncome,
      searchedHouses,
      maritalStatus,
      spokenLanguage,
      processing,
      serDate,
      profilePhoto,
      // 🆕
      caste,
      star,
      lookingFor,
      typeOfJathakam,
      houseType,
      prefferedPlace,
      prefferedSalary,
      prefferedCourse,
      priceRange,
    } = req.body;

    if (!id)
      return res.status(400).json({ success: false, message: "Record ID is required" });

    const record = await Data.findOne({
      _id: id,
      assignedStaff: staffId,
      isDeleted: false,
    });

    if (!record)
      return res.status(403).json({
        success: false,
        message: "Record not found or not assigned to you.",
      });

    // ✅ Duplicate check (4 fields)
    if (mobile || whatsapp || altMobNumber || refferenceNumber) {
      const numbersToCheck = [mobile, whatsapp, altMobNumber, refferenceNumber].filter(Boolean);
      const uniqueNumbers = new Set(numbersToCheck);
      if (uniqueNumbers.size !== numbersToCheck.length) {
        return res.status(400).json({
          success: false,
          message: "Mobile, WhatsApp, Alternate, and Reference numbers cannot be identical.",
        });
      }

      const duplicateCheckQuery: any = { _id: { $ne: id }, $or: [] };
      const isVisaType = record.data?.toLowerCase() === "visa";
      if (!isVisaType) duplicateCheckQuery.data = record.data;

      numbersToCheck.forEach((num) => {
        duplicateCheckQuery.$or.push(
          { mobile: num },
          { whatsapp: num },
          { altMobNumber: num },
          { refferenceNumber: num }
        );
      });

      const duplicateRecord = await Data.findOne(duplicateCheckQuery);
      if (duplicateRecord) {
        return res.status(400).json({
          success: false,
          message:
            "One of the numbers (Mobile / WhatsApp / Alternate / Reference) already exists in another record.",
        });
      }
    }

    const updateFields = {
      mobile,
      whatsapp,
      altMobNumber,
      name,
      status,
      remarkFirst,
      remarkSecond,
      verified,
      dataType,
      refferenceNumber,
      refferenceName,
      regPayment,
      serPayment,
      contactPersonName,
      regReceived,
      serReceived,
      regBalance,
      serBalance,
      passportNo,
      vSampleSend,
      expectations,
      district,
      education,
      preferCountry,
      city,
      jobType,
      preferJobs,
      religion,
      monthlyIncome,
      searchedHouses,
      maritalStatus,
      spokenLanguage,
      processing,
      serDate,
      profilePhoto,
      // 🆕 Newly added
      caste,
      star,
      lookingFor,
      typeOfJathakam,
      houseType,
      prefferedPlace,
      prefferedSalary,
      prefferedCourse,
      priceRange,
    };

    const updatedRecord = await Data.findByIdAndUpdate(id, updateFields, {
      new: true,
      runValidators: true,
    });

    return res.status(200).json({
      success: true,
      message: "Record updated successfully",
      data: updatedRecord,
    });
  } catch (error: any) {
    console.error("Error updating staff row:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Error updating staff record",
    });
  }
};


export const getFormData = async (req: Request, res: Response) => {
  try {
    const { trackingId } = req.query;

    const form = await FormTracking.findOne(
      { trackingId },
      {
        currentStep: 1,
        status: 1,
        dataId: 1,
        formType: 1,
        isReference: 1,
        allowMultiple: 1,
      }
    );
    if (!form) {
      return res.status(200).json({
        success: false,
        message: "No registration form found on this id",
      });
    }

    let data = null;

    if (form?.dataId && form?.allowMultiple !== true) {
      data = await Data.findOne({ _id: form.dataId });
    }

    return res.status(200).json({
      success: true,
      form,
      data,
    });
  } catch (error: any) {
    console.error("Error fetching data:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error while fetching data",
      error: error.message,
    });
  }
};

export const softDeleteData = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { ids } = req.body;

    // Check if we have IDs from body (array) or params (single)
    const idsToDelete = ids && Array.isArray(ids) ? ids : [id];

    if (!idsToDelete.length || idsToDelete.every((id) => !id)) {
      return res.status(400).json({
        success: false,
        message: "Data ID(s) are required",
      });
    }

    const softDeleteTargets = await Data.find({
      _id: { $in: idsToDelete },
      isDeleted: false,
    });
    const hardDeleteTargets = await Data.find({
      _id: { $in: idsToDelete },
      isDeleted: true,
    });

    if (hardDeleteTargets.length > 0) {
      // Permanently delete records that are already soft-deleted
      const hardDeleteIds = hardDeleteTargets.map((record) => record._id);
      const result = await Data.deleteMany({ _id: { $in: hardDeleteIds } });

      if (result.deletedCount === 0) {
        return res.status(404).json({
          success: false,
          message: "No data records found for permanent deletion",
        });
      }

      return res.status(200).json({
        success: true,
        message: `${result.deletedCount} data record(s) permanently deleted`,
      });
    }

    if (softDeleteTargets.length > 0) {
      // Soft delete multiple records

      const softDeleteIds = softDeleteTargets.map((record) => record._id);
      const result = await Data.updateMany(
        { _id: { $in: softDeleteIds } },
        { isDeleted: true }
      );

      if (result.matchedCount === 0) {
        return res.status(404).json({
          success: false,
          message: "No data records found",
        });
      }

      res.status(200).json({
        success: true,
        message: `${result.modifiedCount} data record(s) deleted successfully`,
      });
    }
  } catch (error: any) {
    console.error("Error soft deleting data:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while deleting data",
      error: error.message,
    });
  }
};
