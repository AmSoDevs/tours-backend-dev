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
import { Notification } from "../../models/Notification";
import { ReminderNotification } from "../../models/ReminderNotificationModel";

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
    const profileId = String(req.query.profileId || "");
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

    if (dataType && dataType !== "all") {
      query.data = { $regex: dataType, $options: "i" };
    }

    if (staffId && staffId !== "all") query.assignedStaff = staffId;

    if (profileId && profileId.trim() !== "") {
      query.profileId = { $regex: profileId.trim(), $options: "i" };
    }

    if (status && status !== "all")
      query.status = { $regex: status, $options: "i" };
    if (dataFilter && dataFilter !== "all")
      query.data = { $regex: dataFilter, $options: "i" };

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

    const isValidDate = (d: string) => !isNaN(new Date(d).getTime());
    if (isValidDate(startDate) || isValidDate(endDate)) {
      const dateFilter: any = {};
      if (isValidDate(startDate)) dateFilter.$gte = new Date(startDate);
      if (isValidDate(endDate))
        dateFilter.$lte = new Date(new Date(endDate).setHours(23, 59, 59, 999));
      query.createdAt = dateFilter;
    }

    // ✅ Sort handling
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

    const skip = (page - 1) * (limit || 0);

    // ✅ Fetch all data
    let data = await Data.find(query)
      .populate("assignedStaff", "name staffId")
      .populate("files")
      .sort(sortObj)
      .skip(skip)
      .limit(limit ? limit : 0);

    const total = await Data.countDocuments(query);

    // ✅ STEP 1: Handle bulk records filtering
    const bulkRecords = data.filter((r) => r.data?.toLowerCase() === "bulk");

    if (bulkRecords.length > 0) {
      const slNos = bulkRecords.map((r) => r.slNo);

      // ✅ STEP 2: Find linked non-bulk records for those slNos
      const linkedRecords = await Data.find({
        slNo: { $in: slNos },
        data: { $ne: "bulk" },
        isDeleted: false,
      }).select("_id slNo");

      const linkedIds = linkedRecords.map((r) => r._id);

      // ✅ STEP 3: Find completed tracking forms
      const completedTrackings = await FormTracking.find({
        dataId: { $in: linkedIds },
        status: { $regex: /^submitted$/i },
      }).select("dataId");

      const completedIds = new Set(
        completedTrackings
          .filter((f) => !!f.dataId)
          .map((f) => f.dataId!.toString())
      );

      // ✅ STEP 4: Get slNos of completed forms
      const completedSlNos = linkedRecords
        .filter((r) => completedIds.has(r._id.toString()))
        .map((r) => r.slNo);

      const completedSlNoSet = new Set(completedSlNos);

      // ✅ STEP 5: Hide completed bulk records
      data = data.filter((r) => {
        const isBulk = r.data?.toLowerCase() === "bulk";
        if (isBulk && completedSlNoSet.has(r.slNo)) return false;
        return true;
      });
    }

    // ✅ STEP 6: Compute derived flags & extra categories
    const mobiles = data
      .map((r) => [r.mobile, r.refferenceNumber])
      .flat()
      .filter(Boolean);

    const relatedRecords = await Data.find({
      $or: [
        { mobile: { $in: mobiles } },
        { refferenceNumber: { $in: mobiles } },
      ],
      isDeleted: false,
    }).select("mobile refferenceNumber data");

    const updatedData = await Promise.all(
      data.map(async (record: any) => {
        const dataType = record.data?.toLowerCase() || "";
        const isBulk = dataType === "bulk";
        const isRegister = dataType === "register";

        const recordMobile = record.mobile?.trim() || "";
        const recordRef = record.refferenceNumber?.trim() || "";

        const related = relatedRecords.filter(
          (r) =>
            r.mobile === recordMobile ||
            r.refferenceNumber === recordMobile ||
            r.mobile === recordRef ||
            r.refferenceNumber === recordRef
        );

        const extraCategories = [
          ...new Set(
            related
              .map((r) => r.data)
              .filter(
                (d) => d && d.toLowerCase() !== record.data?.toLowerCase()
              )
          ),
        ];

        let isReferenceRegistered = false;
        let isBulkRegistered = false;

        if (record.refferenceNumber) {
          const registeredRef = await Data.findOne({
            $or: [
              { mobile: record.refferenceNumber },
              { refferenceNumber: record.refferenceNumber },
            ],
            data: "register",
            isDeleted: false,
          });
          if (registeredRef) isReferenceRegistered = true;
        }

        if (record.mobile) {
          const selfRegistered = await Data.findOne({
            $or: [
              { mobile: record.mobile },
              { refferenceNumber: record.mobile },
            ],
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
          extraCategories,
        };
      })
    );

    // ✅ STEP 7: Type filter (new/old)
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

    // ✅ STEP 8: Pagination
    const pagination = {
      currentPage: page,
      totalPages: limit ? Math.ceil(total / limit) : 1,
      totalRecords: total,
      limit: limit || total,
    };

    // ✅ STEP 9: Return response
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
      lookingFor,
      star,
      typeOfJathakam,
      prefferedSalary,
      passportNo,
      aadharId,
      caste,
      priceRange,
      visaType,
      prefferedPlace,
      isDuplicateAllowed,
    } = req.body;

    // ✅ Basic validation
    if (!name || !mobile) {
      return res.status(400).json({
        success: false,
        message: "Name and mobile number are required.",
      });
    }

    // ✅ Validate form tracking
    const form = await FormTracking.findOne({ trackingId });
    if (!form) {
      return res.status(400).json({
        success: false,
        message: "Invalid form ID",
      });
    }

    const isMultipleAllowed = form.allowMultiple === true;

    // ✅ Step 1: Prevent unwanted duplicates if multiple not allowed
    if (!isMultipleAllowed) {
      const duplicateRecord = await checkDuplicateNumbers(
        { mobile, whatsapp, altMobNumber },
        form.formType
      );

      if (
        duplicateRecord &&
        !duplicateRecord.isDuplicateAllowed &&
        req.body.isDuplicateAllowed !== true
      ) {
        return res.status(400).json({
          success: false,
          message:
            "One of the numbers (mobile / WhatsApp / alternate) already exists in another record and duplicates are not allowed.",
        });
      }
    }

    // ✅ Step 2: Find existing bulk record (if exists)
    const existingBulk = await Data.findOne({
      data: "bulk",
      $or: [{ mobile }, { refferenceNumber: mobile }],
      isDeleted: false,
    });

    let slNo, profileId;

    if (existingBulk) {
      // 🔹 Reuse bulk's slNo for continuity
      slNo = existingBulk.slNo;

      // 🔹 Always generate a NEW profile ID sequentially (even if duplicates are false)
      profileId =
        await dataControllerHooks.createRegistrationUniqueSerialNumber(
          form.formType
        );

      // 🔹 Only mark bulk as "Success" if duplicates are NOT allowed
      if (!isDuplicateAllowed) {
        await Data.findByIdAndUpdate(existingBulk._id, {
          $set: { status: "Success", reminderDateAndTime: new Date() },
        });
      }
    } else {
      // 🔹 No bulk record → new slNo and profileId
      slNo = await dataControllerHooks.createRegistrationUniqueSerialNumber(
        form.formType
      );
      profileId = slNo;
    }

    // ✅ Step 3: Assign staff
    let assignedStaff: any;
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

      const { assignedStaffId } = await assignStaffForSingleRecord(
        staffMembers
      );
      assignedStaff = assignedStaffId;
    }

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
      assignedStaff,
      houseType: req.body.houseType,
      prefferedCourse: req.body.prefferedCourse,
      priceRange,
      caste,
      lookingFor,
      star,
      typeOfJathakam,
      prefferedSalary,
      passportNo,
      aadharId,
      visaType,
      prefferedPlace,
      isDuplicateAllowed,
      isDeleted: false,
    });

    await newData.save();

    // ✅ Step 5: Update FormTracking progress
    form.status = "in_progress";
    form.currentStep = 1;

    // ✅ Step 7: Auto-create a linked "register" record when creating any non-register form
    if (form.formType.toLowerCase() !== "register") {
      const existingRegister = await Data.findOne({
        $or: [{ mobile }, { refferenceNumber: mobile }],
        data: "register",
        isDeleted: false,
      });

      if (!existingRegister) {
        console.log(`🪄 Auto-creating Register for ${name} (${mobile})`);

        // 1️⃣ Copy all fields except internal/meta ones
        const newDataObject = newData.toObject();
        const fieldsToExclude = [
          "_id",
          "__v",
          "createdAt",
          "updatedAt",
          "profileId",
          "data",
          "isDeleted",
          "status",
        ];

        const registerCopy: Record<string, any> = {};
        for (const [key, value] of Object.entries(newDataObject)) {
          if (!fieldsToExclude.includes(key)) registerCopy[key] = value;
        }

        // 2️⃣ Generate new unique profile ID for Register with prefix "R"
        const registerProfileId =
          await dataControllerHooks.createRegistrationUniqueSerialNumber(
            "register"
          );

        // 3️⃣ Set required register fields
        registerCopy.data = "register";
        registerCopy.dataType = "self";
        registerCopy.slNo = newData.slNo; // same SL number links them
        registerCopy.profileId = registerProfileId;
        registerCopy.assignedStaff = newData.assignedStaff;
        registerCopy.isDeleted = false;
        registerCopy.status = "Pending";
        registerCopy.refferenceNumber = newData.mobile; // Link original form's mobile as reference

        // 4️⃣ Create and save new Register record
        const registerData = new Data(registerCopy);
        await registerData.save();

        console.log(`✅ Register created successfully for ${name} (${mobile})`);
      } else {
        console.log(
          `ℹ Register already exists for ${name} (${mobile}), skipping creation.`
        );
      }
    }

    if (!isMultipleAllowed) {
      form.dataId = newData._id;
      if (!form.staffId) form.staffId = assignedStaff;
    }

    await form.save();

    if (existingBulk) {
      const mirrorFields = {
        name,
        whatsapp,
        altMobNumber,
        gender,
        religion,
        caste,
        education,
        jobType,
        district,
        city,
        expectations,
        maritalStatus,
      };
      await Data.findByIdAndUpdate(existingBulk._id, { $set: mirrorFields });
    }

    // ✅ Final Response
    return res.status(201).json({
      success: true,
      message: existingBulk
        ? "Registration created and linked to bulk record"
        : "New registration created successfully",
      data: newData,
    });
  } catch (error: any) {
    console.error("❌ Error submitting form:", error);
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
      lookingFor,
      star,
      typeOfJathakam,
      caste,
      prefferedSalary,
      passportNo,
      aadharId,
      priceRange,
      visaType,
      prefferedPlace,
      isDuplicateAllowed,
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

    if (
      duplicateRecord &&
      !duplicateRecord.isDuplicateAllowed &&
      req.body.isDuplicateAllowed !== true
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Duplicate number found in another record, and duplicates are not allowed.",
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
        lookingFor,
        star,
        typeOfJathakam,
        caste,
        prefferedSalary,
        passportNo,
        aadharId,
        priceRange,
        visaType,
        prefferedPlace,
        isDuplicateAllowed,
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
      lookingFor,
      star,
      typeOfJathakam,
      caste,
      prefferedSalary,
      passportNo,
      aadharId,
      priceRange,
      visaType,
      prefferedPlace,
      isDuplicateAllowed,
    };

    Object.keys(updateFields).forEach((k) => {
      if (updateFields[k] === undefined) delete updateFields[k];
    });

    const updatedRecord = await Data.findByIdAndUpdate(
      recordToUpdate._id,
      { $set: updateFields },
      { new: true, runValidators: true }
    );

    // ✅ Mirror updated fields to linked bulk record (auto-sync)
    if (updatedRecord?.slNo && updatedRecord?.data !== "bulk") {
      const linkedBulk = await Data.findOne({
        slNo: updatedRecord.slNo,
        data: "bulk",
        isDeleted: false,
      });

      if (linkedBulk) {
        const bulkUpdateFields = { ...updateFields };
        delete bulkUpdateFields.status;
        delete bulkUpdateFields.assignedStaff;
        delete bulkUpdateFields.isDeleted;

        await Data.findByIdAndUpdate(linkedBulk._id, {
          $set: bulkUpdateFields,
        });
      }
    }

    if (step !== undefined) form.currentStep = step;
    if (step === 3) form.status = "submitted";
    if (!allowMultiple) await form.save();

    // ✅ Universal Auto-Sync across all linked forms (Register, Matrimony, Job, Visa, etc.)
    if (updatedRecord && updatedRecord.slNo) {
      const recordObj = updatedRecord.toObject();

      // fields to sync between all forms
      const syncFields = [
        "name",
        "mobile",
        "whatsapp",
        "altMobNumber",
        "gender",
        "religion",
        "caste",
        "education",
        "district",
        "city",
        "job",
        "maritalStatus",
        "expectations",
        "jobType",
        "monthlyIncome",
        "preferCountry",
        "preferJobs",
        "visaType",
        "searchedHouses",
        "prefferedPlace",
        "prefferedSalary",
        "priceRange",
        "spokenLanguage",
        "lookingFor",
        "typeOfJathakam",
        "star",
        "prefferedCourse",
        "houseType",
        "dateOfBirth",
        "contactPersonName",
        "createProfileFor",
        "passportNo",
        "aadharId",
      ];

      const syncData: Record<string, any> = {};
      for (const field of syncFields) {
        if (recordObj[field as keyof typeof recordObj] !== undefined) {
          syncData[field] = recordObj[field as keyof typeof recordObj];
        }
      }

      // 🔹 Update all other records sharing same slNo (excluding current one)
      const syncResult = await Data.updateMany(
        {
          slNo: updatedRecord.slNo,
          _id: { $ne: updatedRecord._id },
          isDeleted: false,
        },
        { $set: syncData }
      );

      console.log(
        `🔄 Synced ${syncResult.modifiedCount} linked record(s) for ${updatedRecord.name} (${updatedRecord.mobile})`
      );
    }

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
    const { id } = req.body;
    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Record ID is required",
      });
    }

    const existingRecord = await Data.findById(id);
    if (!existingRecord) {
      return res.status(404).json({
        success: false,
        message: "Record not found",
      });
    }

    // ✅ Clean input
    let updateFields: Record<string, any> = { ...req.body };
    Object.keys(updateFields).forEach((key) => {
      if (updateFields[key] === undefined) delete updateFields[key];
    });

    // ✅ Prevent unnecessary index validation
    if (updateFields.mobile === existingRecord.mobile)
      delete updateFields.mobile;
    if (updateFields.data === existingRecord.data) delete updateFields.data;

    updateFields = dataControllerHooks.managetRegistrationPaymentUpdate(
      existingRecord,
      updateFields
    );

    // ✅ Try update safely
    let updatedRecord;
    try {
      updatedRecord = await Data.findByIdAndUpdate(id, updateFields, {
        new: true,
        runValidators: true,
      });
    } catch (error: any) {
      if (error.code === 11000) {
        const field = Object.keys(error.keyPattern).join(", ");
        return res.status(400).json({
          success: false,
          message: `Duplicate value for ${field}. A record already exists with this mobile number for the same form type.`,
        });
      }
      throw error;
    }

    // ✅ Sync only to bulk record, not all related
    if (updatedRecord) {
      const syncFields = [
        "name",
        "mobile",
        "altMobNumber",
        "whatsapp",
        "gender",
        "religion",
        "caste",
        "education",
        "district",
        "city",
        "maritalStatus",
        "expectations",
        "jobType",
        "monthlyIncome",
        "preferCountry",
        "preferJobs",
        "spokenLanguage",
        "visaType",
        "searchedHouses",
        "prefferedPlace",
        "prefferedSalary",
        "priceRange",
        "houseType",
        "prefferedCourse",
        "lookingFor",
        "typeOfJathakam",
        "star",
        "dateOfBirth",
        "contactPersonName",
        "createProfileFor",
        "passportNo",
        "aadharId",
      ];

      const recordObj = updatedRecord.toObject();
      const syncData: Record<string, any> = {};

      for (const field of syncFields) {
        if (recordObj[field as keyof typeof recordObj] !== undefined) {
          syncData[field] = recordObj[field as keyof typeof recordObj];
        }
      }

      // ✅ Update the bulk record
      await Data.updateMany(
        { slNo: updatedRecord.slNo, data: "bulk", isDeleted: false },
        { $set: syncData }
      );

      // ✅ Also update other linked records (job, matrimony, etc.)
      await Data.updateMany(
        {
          slNo: updatedRecord.slNo,
          _id: { $ne: updatedRecord._id }, // skip self
          data: { $ne: "bulk" },
          isDeleted: false,
        },
        { $set: syncData }
      );
    }

    return res.status(200).json({
      success: true,
      message:
        "Record updated successfully (and synced to bulk record if exists)",
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

    // 🔹 Query params
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
    const profileId = String(req.query.profileId || "");
    const showRemindersOnly = String(req.query.showRemindersOnly || "false");

    // 🔹 Base query: only data assigned to this staff
    const query: any = {
      isDeleted: false,
      assignedStaff: staffId,
    };

    // 🔹 Filter to show only records with active reminders
    // 🔹 Filter to show only records with reminders (past or future)
    if (showRemindersOnly === "true") {
      query.hasReminder = true;
      query.reminderDateAndTime = { $ne: null };
    }

    // 🔹 Filters
    if (dataType && dataType !== "all")
      query.dataType = { $regex: dataType, $options: "i" };
    if (status && status !== "all")
      query.status = { $regex: status, $options: "i" };
    if (dataFilter && dataFilter !== "all")
      query.data = { $regex: dataFilter, $options: "i" };
    if (profileId && profileId.trim() !== "") {
      query.profileId = { $regex: profileId.trim(), $options: "i" };
    }

    // 🔹 Date filter
    const isValidDate = (d: string): boolean =>
      !!d && !isNaN(new Date(d).getTime());
    if (isValidDate(startDate) || isValidDate(endDate)) {
      const dateFilter: any = {};
      if (isValidDate(startDate)) dateFilter.$gte = new Date(startDate);
      if (isValidDate(endDate))
        dateFilter.$lte = new Date(new Date(endDate).setHours(23, 59, 59, 999));
      query.createdAt = dateFilter;
    }

    // 🔹 Search
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

    const sortObj: any = {};
    if (showRemindersOnly === "true") {
      sortObj.reminderDateAndTime = 1;
    } else {
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
    }

    const skip = (page - 1) * (limit || 0);
    // 🔹 If only showing reminders, sort by nearest reminder first
    if (showRemindersOnly === "true") {
      sortObj.reminderDateAndTime = 1;
    }

    // ✅ Step 1: Fetch assigned data
    let data = await Data.find(query)
      .populate("assignedStaff", "name staffId")
      .sort(sortObj)
      .skip(skip)
      .limit(limit ? limit : 0);

    const total = await Data.countDocuments(query);

    // ✅ Step 2: Collect all mobile/references to fetch related records
    const mobiles = data
      .map((r) => [r.mobile, r.refferenceNumber])
      .flat()
      .filter(Boolean);

    const relatedRecords = await Data.find({
      $or: [
        { mobile: { $in: mobiles } },
        { refferenceNumber: { $in: mobiles } },
      ],
      isDeleted: false,
    }).select("mobile refferenceNumber data");

    // ✅ Step 3: Find all bulk records for filtering
    const bulkRecords = data.filter((r) => r.data?.toLowerCase() === "bulk");

    if (bulkRecords.length > 0) {
      const slNos = bulkRecords.map((r) => r.slNo);

      // Linked non-bulk records
      const linkedRecords = await Data.find({
        slNo: { $in: slNos },
        data: { $ne: "bulk" },
        isDeleted: false,
      }).select("_id slNo");

      const linkedIds = linkedRecords.map((r) => r._id);

      // Completed form tracking
      const completedTrackings = await FormTracking.find({
        dataId: { $in: linkedIds },
        status: { $regex: /^submitted$/i },
      }).select("dataId");

      const completedIds = new Set(
        completedTrackings
          .filter((f) => !!f.dataId)
          .map((f) => f.dataId!.toString())
      );

      const completedSlNos = linkedRecords
        .filter((r) => completedIds.has(r._id.toString()))
        .map((r) => r.slNo);

      const completedSlNoSet = new Set(completedSlNos);

      // ✅ Step 4: Hide bulk records that are fully completed
      data = data.filter((r) => {
        const isBulk = r.data?.toLowerCase() === "bulk";
        if (isBulk && completedSlNoSet.has(r.slNo)) return false;
        return true;
      });
    }

    // ✅ Step 5: Compute derived flags & extra categories
    const updatedData = await Promise.all(
      data.map(async (record: any) => {
        const dataType = record.data?.toLowerCase() || "";
        const isBulk = dataType === "bulk";
        const isRegister = dataType === "register";

        const recordMobile = record.mobile?.trim() || "";
        const recordRef = record.refferenceNumber?.trim() || "";

        // Find related categories (visa, job, matrimony, etc.)
        const related = relatedRecords.filter(
          (r) =>
            r.mobile === recordMobile ||
            r.refferenceNumber === recordMobile ||
            r.mobile === recordRef ||
            r.refferenceNumber === recordRef
        );

        const extraCategories = [
          ...new Set(
            related
              .map((r) => r.data)
              .filter(
                (d) => d && d.toLowerCase() !== record.data?.toLowerCase()
              )
          ),
        ];

        let isReferenceRegistered = false;
        let isBulkRegistered = false;

        if (record.refferenceNumber) {
          const registeredRef = await Data.findOne({
            $or: [
              { mobile: record.refferenceNumber },
              { refferenceNumber: record.refferenceNumber },
            ],
            data: "register",
            isDeleted: false,
          });
          if (registeredRef) isReferenceRegistered = true;
        }

        if (record.mobile) {
          const selfRegistered = await Data.findOne({
            $or: [
              { mobile: record.mobile },
              { refferenceNumber: record.mobile },
            ],
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
          extraCategories,
        };
      })
    );

    // ✅ Step 6: Type filter (new / old)
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

    // ✅ Step 7: Pagination response
    const pagination = {
      currentPage: page,
      totalPages: limit ? Math.ceil(total / limit) : 1,
      totalRecords: total,
      limit: limit || total,
    };

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

    // 🧩 Validate input
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

    // 🧩 Verify ownership - ensure all records belong to this staff
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

    // 🧩 Prepare update object
    const updateData: any = { status };

    if (reminderDateAndTime) {
      updateData.reminderDateAndTime = new Date(reminderDateAndTime);
      updateData.hasReminder = true;
    } else {
      updateData.reminderDateAndTime = null;
      updateData.hasReminder = false;
    }

    // 🧩 Perform the update
    const updateResult = await Data.updateMany(
      {
        _id: { $in: ids },
        assignedStaff: staffId,
        isDeleted: false,
      },
      { $set: updateData }
    );

    if (updateResult.modifiedCount === 0) {
      return res.status(404).json({
        success: false,
        message: "No records found to update.",
      });
    }

    // 🧩 Handle Reminder Scheduling (if reminderDateAndTime provided)
    if (reminderDateAndTime) {
      for (const record of records) {
        try {
          await ReminderNotification.findOneAndUpdate(
            {
              staffId,
              profileId: record.profileId || record.slNo,
            },
            {
              staffId,
              profileId: record.profileId || record.slNo,
              name: record.name,
              phone: record.mobile,
              remarks: record.remarkFirst || record.remarkSecond || "",
              message: `⏰ Reminder: Follow-up with ${
                record.name || "Client"
              } (${record.mobile}) scheduled.`,
              reminderDateAndTime: new Date(reminderDateAndTime),
              notified: false,
              isRead: false,
            },
            { upsert: true, new: true }
          );
        } catch (err) {
          console.error(
            `❌ Failed to create reminder for record ${record._id}:`,
            err
          );
        }
      }

      console.log(
        `✅ ${records.length} reminder(s) scheduled for staff ${staffId}`
      );
    }

    // ✅ Response
    return res.status(200).json({
      success: true,
      message: `Successfully updated ${updateResult.modifiedCount} record(s)${
        reminderDateAndTime ? " and scheduled reminders" : ""
      }.`,
      updatedCount: updateResult.modifiedCount,
    });
  } catch (error: any) {
    console.error("❌ Error updating staff data status:", error);
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
    const { id } = req.body;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Record ID is required",
      });
    }

    // ✅ Verify record ownership
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

    // ✅ Prepare update fields safely
    let updateFields: Record<string, any> = { ...req.body };
    Object.keys(updateFields).forEach((key) => {
      if (updateFields[key] === undefined) delete updateFields[key];
    });

    // ✅ Prevent re-indexing unchanged unique fields
    if (updateFields.mobile === record.mobile) delete updateFields.mobile;
    if (updateFields.data === record.data) delete updateFields.data;

    // ✅ Apply payment auto-timestamping logic
    updateFields = dataControllerHooks.managetRegistrationPaymentUpdate(
      record,
      updateFields
    );

    const changedPayments: string[] = [];
    if (
      updateFields.regPayment !== undefined &&
      updateFields.regPayment !== record.regPayment
    )
      changedPayments.push("Registration Payment");
    if (
      updateFields.serPayment !== undefined &&
      updateFields.serPayment !== record.serPayment
    )
      changedPayments.push("Service Payment");
    if (
      updateFields.regReceived !== undefined &&
      updateFields.regReceived !== record.regReceived
    )
      changedPayments.push("Registration Received");
    if (
      updateFields.serReceived !== undefined &&
      updateFields.serReceived !== record.serReceived
    )
      changedPayments.push("Service Received");

    if (changedPayments.length > 0) {
      const staff = await Staff.findById(staffId).select("name");
      const message = `${
        staff?.name || "A staff"
      } updated ${changedPayments.join(", ")} for ${
        record.name || "Unknown"
      } (${record.profileId || record.slNo})`;

      const newNotification = await Notification.create({
        staffId,
        profileId: record.profileId || record.slNo,
        name: record.name,
        message,
        type: "payment_update",
      });

      console.log("Notification Created:", {
        id: newNotification._id,
        message: newNotification.message,
        createdAt: newNotification.createdAt,
      });

      const approvalUpdates: any = { ...record.isPaymentApproved };

      if (
        updateFields.regPayment !== undefined &&
        updateFields.regPayment !== record.regPayment
      )
        approvalUpdates.regPaymentApproved = "pending";

      if (
        updateFields.serPayment !== undefined &&
        updateFields.serPayment !== record.serPayment
      )
        approvalUpdates.serPaymentApproved = "pending";

      if (
        updateFields.regReceived !== undefined &&
        updateFields.regReceived !== record.regReceived
      )
        approvalUpdates.regReceivedApproved = "pending";

      if (
        updateFields.serReceived !== undefined &&
        updateFields.serReceived !== record.serReceived
      )
        approvalUpdates.serReceivedApproved = "pending";

      const isAnyAction = Object.values(approvalUpdates).some(
        (val) => val && val !== "null"
      );

      updateFields.isPaymentApproved = approvalUpdates;
      updateFields.isAdminPaymentApproved = isAnyAction;
    }
    let updatedRecord;
    try {
      updatedRecord = await Data.findByIdAndUpdate(id, updateFields, {
        new: true,
        runValidators: true,
      });
    } catch (error: any) {
      if (error.code === 11000) {
        const field = Object.keys(error.keyPattern).join(", ");
        return res.status(400).json({
          success: false,
          message: `Duplicate value for ${field}. A record already exists with this mobile number for the same form type.`,
        });
      }
      throw error;
    }

    if (updatedRecord) {
      const syncFields = [
        "name",
        "mobile",
        "altMobNumber",
        "whatsapp",
        "gender",
        "religion",
        "caste",
        "education",
        "district",
        "city",
        "maritalStatus",
        "expectations",
        "jobType",
        "monthlyIncome",
        "preferCountry",
        "preferJobs",
        "spokenLanguage",
        "visaType",
        "searchedHouses",
        "prefferedPlace",
        "prefferedSalary",
        "priceRange",
        "houseType",
        "prefferedCourse",
        "lookingFor",
        "typeOfJathakam",
        "star",
        "dateOfBirth",
        "contactPersonName",
        "createProfileFor",
        "passportNo",
        "aadharId",
      ];

      const recordObj = updatedRecord.toObject();
      const syncData: Record<string, any> = {};

      for (const field of syncFields) {
        if (recordObj[field as keyof typeof recordObj] !== undefined) {
          syncData[field] = recordObj[field as keyof typeof recordObj];
        }
      }

      // 🔹 Sync to bulk record (if exists)
      await Data.updateMany(
        { slNo: updatedRecord.slNo, data: "bulk", isDeleted: false },
        { $set: syncData }
      );

      // 🔹 Sync to other related forms (register, job, matrimony, etc.)
      await Data.updateMany(
        {
          slNo: updatedRecord.slNo,
          _id: { $ne: updatedRecord._id },
          data: { $ne: "bulk" },
          isDeleted: false,
        },
        { $set: syncData }
      );
    }

    if (updateFields.reminderDateAndTime) {
      try {
        await ReminderNotification.findOneAndUpdate(
          {
            staffId,
            profileId: record.profileId || record.slNo,
          },
          {
            staffId,
            profileId: record.profileId || record.slNo,
            name: record.name,
            phone: record.mobile,
            remarks: record.remarkFirst || record.remarkSecond || "",
            message: `Reminder: Follow-up with ${record.name || "Client"} (${
              record.mobile
            }) scheduled.`,
            reminderDateAndTime: new Date(updateFields.reminderDateAndTime),
            notified: false,
            isRead: false,
            isIgnoredStaff: false,
          },
          { upsert: true, new: true }
        );

        await Data.findByIdAndUpdate(record._id, {
          $set: { hasReminder: true },
        });

        console.log(` Reminder created for ${record.name}`);
      } catch (err) {
        console.error(
          `Failed to create reminder for record ${record._id}:`,
          err
        );
      }
    }

    return res.status(200).json({
      success: true,
      message: "Record updated successfully (and synced to linked records)",
      data: updatedRecord,
    });
  } catch (error: any) {
    console.error("❌ Error updating staff row:", error);
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

export const approvePaymentStatus = async (req: Request, res: Response) => {
  try {
    const { profileId, field, status } = req.body;

    if (!profileId || !field || !status) {
      return res.status(400).json({
        success: false,
        message: "profileId, field, and status are required.",
      });
    }

    if (
      !["regPayment", "regReceived", "serPayment", "serReceived"].includes(
        field
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid field. Must be one of regPayment, regReceived, serPayment, serReceived.",
      });
    }

    if (!["approved", "rejected", "pending", "null"].includes(status)) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid status. Must be 'approved', 'rejected', 'pending', or 'null'.",
      });
    }

    // Find the record by profileId
    const record = await Data.findOne({ profileId });
    if (!record) {
      return res.status(404).json({
        success: false,
        message: "Profile not found.",
      });
    }

    // Update isPaymentApproved object
    const approvalFieldMap: any = {
      regPayment: "regPaymentApproved",
      regReceived: "regReceivedApproved",
      serPayment: "serPaymentApproved",
      serReceived: "serReceivedApproved",
    };

    const approvalKey = approvalFieldMap[field];

    record.isPaymentApproved = {
      ...record.isPaymentApproved,
      [approvalKey]: status,
    };

    // Auto-toggle main flag
    record.isAdminPaymentApproved = Object.values(
      record.isPaymentApproved || {}
    ).some((val) => val && val !== "null");

    await record.save();

    // if (record.assignedStaff) {
    //   const staff = await Staff.findById(record.assignedStaff).select("name");

    //   const message = `Admin ${status} ${field} for ${
    //     record.name || "Unknown"
    //   } (${record.profileId})`;

    //   await Notification.create({
    //     staffId: record.assignedStaff,
    //     profileId: record.profileId,
    //     name: record.name,
    //     message,
    //     type: "payment_approval",
    //   });

    //   console.log("✅ Notification Created:", message);
    // }

    return res.status(200).json({
      success: true,
      message: `Payment ${field} marked as ${status} successfully.`,
      data: record,
    });
  } catch (error: any) {
    console.error("Error approving payment:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error while approving payment.",
      error: error.message,
    });
  }
};
