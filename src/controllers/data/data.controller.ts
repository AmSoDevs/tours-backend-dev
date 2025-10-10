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
} from "../../utils/helper";
import { FormTracking } from "../../models/FormTracking";
import { dataControllerHooks } from "./data.controller.hooks";

export const importData = async (req: Request, res: Response) => {
  try {
    const { dataType, data } = req.body;

    const existingNonNumericSlNo = await Data.findOne({
      slNo: { $not: /^\d{6}$/ },
    });

    if (existingNonNumericSlNo) {
      console.log(
        "Warning: Found existing records with non-numeric slNo. These may cause conflicts."
      );
    }

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
      errors: [] as string[],
    };

    const batchSize = 100;
    const batches = [];

    for (let i = 0; i < data.length; i += batchSize) {
      batches.push(data.slice(i, i + batchSize));
    }

    // Initialize staff assignment tracking
    let staffAssignment = await StaffAssignment.findOne();
    if (!staffAssignment) {
      staffAssignment = new StaffAssignment({
        lastAssignedStaffId: null,
        totalAssignedRecords: 0,
      });
      await staffAssignment.save();
    }

    for (const batch of batches) {
      for (let index = 0; index < batch.length; index++) {
        const record = batch[index];

        try {
          // Build duplicate check query with proper null handling
          const duplicateQuery: any[] = [];

          if (record.mobile) {
            duplicateQuery.push({ mobile: record.mobile });
            duplicateQuery.push({ refferenceNumber: record.mobile });
          }

          if (record.refferenceNumber) {
            duplicateQuery.push({ mobile: record.refferenceNumber });
            duplicateQuery.push({ refferenceNumber: record.refferenceNumber });
          }

          const existingRecord =
            duplicateQuery.length > 0
              ? await Data.findOne({ $or: duplicateQuery })
              : null;

          if (existingRecord) {
            results.duplicateRecords++;
            continue;
          }

          // Use helper function to assign staff for non-duplicate records only
          const { assignedStaffId, staffAssignment: updatedStaffAssignment } =
            await assignStaffWithRotation(staffMembers);
          const assignedStaff = assignedStaffId;
          staffAssignment = updatedStaffAssignment;

          const slNo = await generateUniqueSlNo();
          const profileId = await generateUniqueProfileId();

          const newData = new Data({
            slNo: slNo,
            profileId: profileId,
            data: dataType,
            dataType: record?.dataType || "",
            verified: record.verified || "",
            mobile: record.mobile,
            name: record.name || "",
            remarkFirst: record.remarkFirst || "",
            refferenceNumber: record.refferenceNumber || "",
            refferenceName: record.refferenceName || "",
            remarkSecond: record.remarkSecond || "",
            assignedStaff: assignedStaff,
          });

          await newData.save();
          results.importedRecords++;
        } catch (error: any) {
          console.error("Error processing record:", record.slNo, error);
          const errorMessage = `Error processing record ${record.slNo}: ${error.message}`;
          results.errors.push(errorMessage);
        }
      }
    }

    return res.status(200).json({
      success: true,
      message: "Data import completed",
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
    const {
      page = 1,
      limit,
      dataType,
      staffId,
      status,
      data: dataFilter,
      search,
      sortBy = "createdAt",
      sortOrder = "desc",
      showDeletedOnly = false,
      showWithRemindersOnly = false,
      
    } = req.query;

    const query: any = {}


    if (showDeletedOnly === "true") {
      query.isDeleted = true;
    }
    else {
      query.isDeleted = false;
    }

    if(showWithRemindersOnly==="true"){
      query.reminderDateAndTime = { $ne: null };

    }



    if (dataType && dataType !== "all") {
      query.dataType = { $regex: dataType, $options: "i" };
    }

    if (staffId && staffId !== "all") {
      query.assignedStaff = staffId;
    }

    if (status && status !== "all") {
      query.status = { $regex: status, $options: "i" };
    }

    if (dataFilter && dataFilter !== "all") {
      if (dataFilter === "register") {
        query.data = { $in: ["register", "house", "matrimony", "job", "visa"] };
      } else {
        query.data = { $regex: dataFilter, $options: "i" };
      }
    }

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
    if (sortBy === "createdAt") {
      sortObj.createdAt = sortOrder === "desc" ? -1 : 1;
    } else if (sortBy === "updatedAt") {
      sortObj.updatedAt = sortOrder === "desc" ? -1 : 1;
    } else if (sortBy === "name") {
      sortObj.name = sortOrder === "desc" ? -1 : 1;
    } else if (sortBy === "mobile") {
      sortObj.mobile = sortOrder === "desc" ? -1 : 1;
    } else if (sortBy === "status") {
      sortObj.status = sortOrder === "desc" ? -1 : 1;
    } else if (sortBy === "slNo") {
      sortObj.slNo = sortOrder === "desc" ? -1 : 1;
    } else if (sortBy === "assignedStaff.staffId") {
      sortObj["assignedStaff.staffId"] = sortOrder === "desc" ? -1 : 1;
    }

    let data;
    let total;
    let pagination;
    if (limit) {
      const skip = (Number(page) - 1) * Number(limit);
      data = await Data.find(query)

        .populate("assignedStaff", "name staffId")
        .populate("files")
        .sort(sortObj)
        .skip(skip)
        .limit(Number(limit));

      total = await Data.countDocuments(query);
      pagination = {
        currentPage: Number(page),
        totalPages: Math.ceil(total / Number(limit)),
        totalRecords: total,
        limit: Number(limit),
      };
    } else {
      data = await Data.find(query)
        .populate("assignedStaff", "name staffId")
        .populate("files")
        .sort(sortObj);

      total = data.length;
      pagination = {
        currentPage: 1,
        totalPages: 1,
        totalRecords: total,
        limit: total,
      };
    }

    return res.status(200).json({
      success: true,
      data,
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
      reminderDateAndTime: { $ne: null } 
    });

    const recordWithoutReminders = await Data.find({ 
      _id: { $in: ids }, 
      $or: [
        { reminderDateAndTime: { $eq: null } },
        { reminderDateAndTime: { $exists: false } }
      ]
    });


    const updateDataWithReminders: any = {
      status: status,
      reminderDateAndTime:""
    };

    const updateDataWithoutReminders: any = {
      status: status,
      reminderDateAndTime : new Date(reminderDateAndTime) 
    };

    if(recordsWithReminders?.length){

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

    if(recordWithoutReminders?.length){

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
        message: "Invalid form id",
      });
    }

    const existingRecord = await Data.findOne({
      $and: [
        {
          $or: [{ mobile: mobile }, { refferenceNumber: mobile }],
        },
        { data: form?.formType, },
      ],
    });

    if (existingRecord && form?.status === "shared") {
      return res.status(400).json({
        success: false,
        message: "Mobile number already exists.",
      });
    }
    //  else if (!existingRecord && form?.status === "in_progress") {
    //   return res.status(400).json({
    //     success: false,
    //     message: "Record not found. Please submit the form first.",
    //   });
    // }
    let assignedStaff: any;
    let staffAssignment: any;

    if (form?.staffId) {
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
    let newData;
    let updateData:any = {
      data: form?.formType,
      mobile,
      name,
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
      assignedStaff: assignedStaff,
      isDeleted: false,
    };
    if (form?.dataId) {

      if(existingRecord?.data==="bulk" ||!existingRecord?.data ){
        updateData.profileId = await dataControllerHooks.createRegistrationUniqueSerialNumber(form?.formType);
      }
     
      newData = await Data.findByIdAndUpdate(form?.dataId, updateData, {
        new: true,
        runValidators: true,
      });
    } else {


      const slNo = await generateUniqueSlNo();
      const profileId = await dataControllerHooks.createRegistrationUniqueSerialNumber(form?.formType);

      newData = new Data({
        ...updateData,
        slNo,
        profileId,
        dataType: "self",
        data: form?.formType,
      });

      await newData.save();
    }
    form.status = "in_progress";
    form.dataId = newData?._id;
    form.currentStep = 1;

    // Only assign staff if not already assigned
    if (!form.staffId) {
      form.staffId = assignedStaff;
    }

    await form.save();

    // Staff assignment is already saved by the helper function
    return res.status(201).json({
      success: true,
      message: "Form submitted successfully",
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
      trackingId,
      _id,
    } = req.body;

    // Validate required fields
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
        message: "Invalid form id",
      });
    }
    // const existingRecord = await Data.findOne({
    //   $or: [{ mobile: mobile }, { refferenceNumber: mobile },{data:form?.formType}],
    // });
    const existingRecord = await Data.findOne( {
            $or: [{ mobile: mobile }, { refferenceNumber: mobile }],
          });
    if (!existingRecord) {
      return res.status(404).json({
        success: false,
        message: "Record not found. Please submit the form first.",
      });
    }
    // if (mobile !== undefined && mobile !== "") {
    //   // Check if mobile is same as existing reference number in this record
    //   if (
    //     existingRecord.refferenceNumber &&
    //     mobile === existingRecord.refferenceNumber
    //   ) {
    //     return res.status(400).json({
    //       success: false,
    //       message:
    //         "Mobile number cannot be the same as the existing reference number in this record.",
    //     });
    //   }

    //   // Check for duplicate mobile numbers in OTHER records (same form type only)
    //   const duplicateCheckQuery = {
    //     _id: { $ne: _id }, // Exclude the current record being updated
    //     $and: [
    //       {
    //         $or: [{ mobile: mobile }, { refferenceNumber: mobile }],
    //       },
    //       { data: form?.formType }, // Only check within same form type
    //     ],
    //   };

    //   const duplicateRecord = await Data.findOne(duplicateCheckQuery);
    //   if (duplicateRecord) {
    //     return res.status(400).json({
    //       success: false,
    //       message:
    //         "Mobile number or reference number already exists in another record.",
    //     });
    //   }
    // }
    const updateFields: any = {};
    if (name !== undefined) updateFields.name = name;
    if (mobile !== undefined) updateFields.mobile = mobile;
    if (whatsapp !== undefined) updateFields.whatsapp = whatsapp;
    if (altMobNumber !== undefined) updateFields.altMobNumber = altMobNumber;
    if (preferCountry !== undefined) updateFields.preferCountry = preferCountry;
    if (preferJobs !== undefined) updateFields.preferJobs = preferJobs;
    if (job !== undefined) updateFields.job = job;
    if (searchedHouses !== undefined)
      updateFields.searchedHouses = searchedHouses;
    if (gender !== undefined) updateFields.gender = gender;
    if (dateOfBirth !== undefined) updateFields.dateOfBirth = dateOfBirth;
    if (maritalStatus !== undefined) updateFields.maritalStatus = maritalStatus;
    if (religion !== undefined) updateFields.religion = religion;
    if (education !== undefined) updateFields.education = education;
    if (jobType !== undefined) updateFields.jobType = jobType;
    if (monthlyIncome !== undefined) updateFields.monthlyIncome = monthlyIncome;
    if (spokenLanguage !== undefined)
      updateFields.spokenLanguage = spokenLanguage;
    if (district !== undefined) updateFields.district = district;
    if (city !== undefined) updateFields.city = city;
    if (expectations !== undefined) updateFields.expectations = expectations;
    if (createProfileFor !== undefined)
      updateFields.createProfileFor = createProfileFor;
    if (contactPersonName !== undefined)
      updateFields.contactPersonName = contactPersonName;
    if (req.body.houseType !== undefined)
      updateFields.houseType = req.body.houseType;
    if (req.body.priceRange !== undefined)
      updateFields.priceRange = req.body.priceRange;
    if (req.body.prefferedPlace !== undefined)
      updateFields.prefferedPlace = req.body.prefferedPlace;
    if (req.body.caste !== undefined) updateFields.caste = req.body.caste;
    if (req.body.passportNo !== undefined)
      updateFields.passportNo = req.body.passportNo;
    if (req.body.aadharId !== undefined)
      updateFields.aadharId = req.body.aadharId;
    if (req.body.prefferedSalary !== undefined)
      updateFields.prefferedSalary = req.body.prefferedSalary;
    if (req.body.visaType !== undefined)
      updateFields.visaType = req.body.visaType;
    if (req.body.prefferedCourse !== undefined)
      updateFields.prefferedCourse = req.body.prefferedCourse;
    if (status !== undefined) updateFields.status = status;
    if (profilePhoto !== undefined) updateFields.profilePhoto = profilePhoto;
    

    // Update the record
    const updatedRecord = await Data.findByIdAndUpdate(_id, updateFields, {
      new: true,
      runValidators: true,
    });
    // Update FormTracking currentStep and status
    if (step !== undefined) {
      form.currentStep = step;
    }
    if (step === 3) {
      form.status = "submitted";
    }
    await form.save();
    return res.status(200).json({
      success: true,
      message: "Form updated successfully",
      data: updatedRecord,
    });
  } catch (error: any) {
    console.error("Error updating form:", error);
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
      prefferedPlace,
      prefferedSalary,
      prefferedCourse,
      priceRange,
      dateOfBirth,
      profilePhoto,
      aadharId,
    } = req.body;

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

    if (mobile !== undefined || refferenceNumber !== undefined) {
      if (
        mobile !== undefined &&
        refferenceNumber !== undefined &&
        mobile === refferenceNumber
      ) {
        return res.status(400).json({
          success: false,
          message: "Mobile number and reference number cannot be the same.",
        });
      }

      if (
        mobile !== undefined &&
        existingRecord.refferenceNumber &&
        mobile === existingRecord.refferenceNumber
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Mobile number cannot be the same as the existing reference number in this record.",
        });
      }

      if (
        refferenceNumber !== undefined &&
        existingRecord.mobile &&
        refferenceNumber === existingRecord.mobile
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Reference number cannot be the same as the existing mobile number in this record.",
        });
      }

      const duplicateCheckQuery: any = {
        _id: { $ne: id }, // Exclude the current record being updated
        $or: [],
      };

      if (mobile !== undefined && mobile !== "") {
        duplicateCheckQuery.$or.push(
          { mobile: mobile },
          { refferenceNumber: mobile }
        );
      }

      if (refferenceNumber !== undefined && refferenceNumber !== "") {
        duplicateCheckQuery.$or.push(
          { mobile: refferenceNumber },
          { refferenceNumber: refferenceNumber }
        );
      }
      if (duplicateCheckQuery.$or.length > 0) {
        const duplicateRecord = await Data.findOne(duplicateCheckQuery);

        if (duplicateRecord) {
          return res.status(400).json({
            success: false,
            message:
              "Mobile number or reference number already exists in another record.",
          });
        }
      }
    }

    const updateFields: any = dataControllerHooks.managetRegistrationPaymentUpdate(existingRecord,req.body );
   
    if (mobile !== undefined) updateFields.mobile = mobile;
    if (altMobNumber !== undefined) updateFields.altMobNumber = altMobNumber;
    if (name !== undefined) updateFields.name = name;
    if (status !== undefined) updateFields.status = status;
    if (remarkFirst !== undefined) updateFields.remarkFirst = remarkFirst;
    if (remarkSecond !== undefined) updateFields.remarkSecond = remarkSecond;
    if (verified !== undefined) updateFields.verified = verified;
    if (dataType !== undefined) updateFields.dataType = dataType;
    if (dateOfBirth !== undefined) updateFields.dateOfBirth = dateOfBirth;
    if (refferenceNumber !== undefined)
      updateFields.refferenceNumber = refferenceNumber;
    if (refferenceName !== undefined)
      updateFields.refferenceName = refferenceName;

    if (regPayment !== undefined) updateFields.regPayment = regPayment;
    if (serPayment !== undefined) updateFields.serPayment = serPayment;
    if (contactPersonName !== undefined)
      updateFields.contactPersonName = contactPersonName;
    if (regReceived !== undefined) updateFields.regReceived = regReceived;
    if (serReceived !== undefined) updateFields.serReceived = serReceived;
    if (regBalance !== undefined) updateFields.regBalance = regBalance;
    if (serBalance !== undefined) updateFields.serBalance = serBalance;
    if (passportNo !== undefined) updateFields.passportNo = passportNo;
    if (vSampleSend !== undefined) updateFields.vSampleSend = vSampleSend;
    if (expectations !== undefined) updateFields.expectations = expectations;
    if (district !== undefined) updateFields.district = district;
    if (education !== undefined) updateFields.education = education;
    if (preferCountry !== undefined) updateFields.preferCountry = preferCountry;
    if (city !== undefined) updateFields.city = city;
    if (jobType !== undefined) updateFields.jobType = jobType;
    if (preferJobs !== undefined) updateFields.preferJobs = preferJobs;
    if (religion !== undefined) updateFields.religion = religion;
    if (monthlyIncome !== undefined) updateFields.monthlyIncome = monthlyIncome;
    if (searchedHouses !== undefined)
      updateFields.searchedHouses = searchedHouses;
    if (maritalStatus !== undefined) updateFields.maritalStatus = maritalStatus;
    if (spokenLanguage !== undefined)
      updateFields.spokenLanguage = spokenLanguage;
    if (processing !== undefined) updateFields.processing = processing;
    if (serDate !== undefined) updateFields.serDate = serDate;
    if (caste !== undefined) updateFields.caste = caste;
    if (job !== undefined) updateFields.job = job;
    if (visaType !== undefined) updateFields.visaType = visaType;
    if (houseType !== undefined) updateFields.houseType = houseType;
    if (typeOfJathakam !== undefined)
      updateFields.typeOfJathakam = typeOfJathakam;
    if (star !== undefined) updateFields.star = star;
    if (prefferedPlace !== undefined)
      updateFields.prefferedPlace = prefferedPlace;
    // Update the record
    if (prefferedSalary !== undefined)
      updateFields.prefferedSalary = prefferedSalary;
    if (prefferedCourse !== undefined)
      updateFields.prefferedCourse = prefferedCourse;
    if (priceRange !== undefined) updateFields.priceRange = priceRange;
    if (profilePhoto !== undefined) updateFields.profilePhoto = profilePhoto;
    if (aadharId !== undefined) updateFields.aadharId = aadharId;
    
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
    console.error("Error updating row:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error while updating record",
      error: error.message,
    });
  }
};

export const getStaffAssignedData = async (req: Request, res: Response) => {
  try {
    const { id: staffId } = req.params;
    const {
      page = 1,
      limit,
      dataType,
      status,
      data: dataFilter,
      search,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    const query: any = {
      isDeleted: false,
      assignedStaff: staffId,
    };

    // Apply filters
    if (dataType && dataType !== "all") {
      query.dataType = { $regex: dataType, $options: "i" };
    }
    if (status && status !== "all") {
      query.status = { $regex: status, $options: "i" };
    } else if (status === "all" || !status) {
      query.status = { $in: [null, "", undefined] };
    }
    if (dataFilter && dataFilter !== "all") {
      query.data = { $regex: dataFilter, $options: "i" };
    }
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

    // Build sort object
    const sortObj: any = {};
    if (sortBy === "createdAt") {
      sortObj.createdAt = sortOrder === "desc" ? -1 : 1;
    } else if (sortBy === "updatedAt") {
      sortObj.updatedAt = sortOrder === "desc" ? -1 : 1;
    } else if (sortBy === "name") {
      sortObj.name = sortOrder === "desc" ? -1 : 1;
    } else if (sortBy === "mobile") {
      sortObj.mobile = sortOrder === "desc" ? -1 : 1;
    } else if (sortBy === "status") {
      sortObj.status = sortOrder === "desc" ? -1 : 1;
    } else if (sortBy === "slNo") {
      sortObj.slNo = sortOrder === "desc" ? -1 : 1;
    } else if (sortBy === "assignedStaff.staffId") {
      sortObj["assignedStaff.staffId"] = sortOrder === "desc" ? -1 : 1;
    }

    let data;
    let total;
    let pagination;

    if (limit) {
      const skip = (Number(page) - 1) * Number(limit);
      data = await Data.find(query)
        .populate("assignedStaff", "name staffId")
        .sort(sortObj)
        .skip(skip)
        .limit(Number(limit));
      total = await Data.countDocuments(query);
      pagination = {
        currentPage: Number(page),
        totalPages: Math.ceil(total / Number(limit)),
        totalRecords: total,
        limit: Number(limit),
      };
    } else {
      data = await Data.find(query)
        .populate("assignedStaff", "name staffId")
        .sort(sortObj);
      total = data.length;
      pagination = {
        currentPage: 1,
        totalPages: 1,
        totalRecords: total,
        limit: total,
      };
    }

    return res.status(200).json({
      success: true,
      data,
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
      name,
      status,
      remarkFirst,
      remarkSecond,
      verified,
      dataType,
      refferenceNumber,
      refferenceName,
      // Register specific fields
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
    } = req.body;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Record ID is required",
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

    if (mobile !== undefined || refferenceNumber !== undefined) {
      if (
        mobile !== undefined &&
        refferenceNumber !== undefined &&
        mobile === refferenceNumber
      ) {
        return res.status(400).json({
          success: false,
          message: "Mobile number and reference number cannot be the same.",
        });
      }

      if (
        mobile !== undefined &&
        record.refferenceNumber &&
        mobile === record.refferenceNumber
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Mobile number cannot be the same as the existing reference number in this record.",
        });
      }

      if (
        refferenceNumber !== undefined &&
        record.mobile &&
        refferenceNumber === record.mobile
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Reference number cannot be the same as the existing mobile number in this record.",
        });
      }

      const duplicateCheckQuery: any = {
        _id: { $ne: id },
        $or: [],
      };

      if (mobile !== undefined) {
        duplicateCheckQuery.$or.push(
          { mobile: mobile },
          { refferenceNumber: mobile }
        );
      }

      if (refferenceNumber !== undefined) {
        duplicateCheckQuery.$or.push(
          { mobile: refferenceNumber },
          { refferenceNumber: refferenceNumber }
        );
      }

      const duplicateRecord = await Data.findOne(duplicateCheckQuery);
      if (duplicateRecord) {
        return res.status(400).json({
          success: false,
          message:
            "Mobile number or reference number already exists in another record.",
        });
      }
    }

    // Prepare update object with only provided fields
    const updateFields: any = {};
    if (mobile !== undefined) updateFields.mobile = mobile;
    if (name !== undefined) updateFields.name = name;
    if (status !== undefined) updateFields.status = status;
    if (remarkFirst !== undefined) updateFields.remarkFirst = remarkFirst;
    if (remarkSecond !== undefined) updateFields.remarkSecond = remarkSecond;
    if (verified !== undefined) updateFields.verified = verified;
    if (dataType !== undefined) updateFields.dataType = dataType;
    if (refferenceNumber !== undefined)
      updateFields.refferenceNumber = refferenceNumber;
    if (refferenceName !== undefined)
      updateFields.refferenceName = refferenceName;

    // Register specific fields
    if (regPayment !== undefined) updateFields.regPayment = regPayment;
    if (serPayment !== undefined) updateFields.serPayment = serPayment;
    if (contactPersonName !== undefined)
      updateFields.contactPersonName = contactPersonName;
    if (regReceived !== undefined) updateFields.regReceived = regReceived;
    if (serReceived !== undefined) updateFields.serReceived = serReceived;
    if (regBalance !== undefined) updateFields.regBalance = regBalance;
    if (serBalance !== undefined) updateFields.serBalance = serBalance;
    if (passportNo !== undefined) updateFields.passportNo = passportNo;
    if (vSampleSend !== undefined) updateFields.vSampleSend = vSampleSend;
    if (expectations !== undefined) updateFields.expectations = expectations;
    if (district !== undefined) updateFields.district = district;
    if (education !== undefined) updateFields.education = education;
    if (preferCountry !== undefined) updateFields.preferCountry = preferCountry;
    if (city !== undefined) updateFields.city = city;
    if (jobType !== undefined) updateFields.jobType = jobType;
    if (preferJobs !== undefined) updateFields.preferJobs = preferJobs;
    if (religion !== undefined) updateFields.religion = religion;
    if (monthlyIncome !== undefined) updateFields.monthlyIncome = monthlyIncome;
    if (searchedHouses !== undefined)
      updateFields.searchedHouses = searchedHouses;
    if (maritalStatus !== undefined) updateFields.maritalStatus = maritalStatus;
    if (spokenLanguage !== undefined)
      updateFields.spokenLanguage = spokenLanguage;
    if (processing !== undefined) updateFields.processing = processing;
    if (serDate !== undefined) updateFields.serDate = serDate;
    if (profilePhoto !== undefined) updateFields.profilePhoto = profilePhoto;

    // Update the record
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
      message: "Internal server error while updating record",
      error: error.message,
    });
  }
};

export const getFormData = async (req: Request, res: Response) => {
  try {
    const { trackingId } = req.query;

    const form = await FormTracking.findOne(
      { trackingId },
      { currentStep: 1, status: 1, dataId: 1, formType: 1, isReference: 1, allowMultiple: 1 }
    );
    if (!form) {
      return res.status(200).json({
        success: false,
        message: "No registration form found on this id",
      });
    }
    let data;
    if (form?.dataId) {
      data = await Data.findOne({ _id: form?.dataId });
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

    const softDeleteTargets = await Data.find({ _id: { $in: idsToDelete }, isDeleted: false });
    const hardDeleteTargets = await Data.find({ _id: { $in: idsToDelete }, isDeleted: true });

    if (hardDeleteTargets.length > 0) { 
      // Permanently delete records that are already soft-deleted
      const hardDeleteIds = hardDeleteTargets.map(record => record._id);
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

      const softDeleteIds = softDeleteTargets.map(record => record._id);
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
