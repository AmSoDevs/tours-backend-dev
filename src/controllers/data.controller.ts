import { Request, Response } from "express";
import { Data } from "../models/Data";
import { Staff } from "../models/Staff";
import { generateUniqueProfileId, generateUniqueSlNo } from "../utils/helper";

export const importData = async (req: Request, res: Response) => {
  try {
    console.log("req.body:", req.body);

    const { dataType, data } = req.body;

    // Check if there are existing records with non-numeric slNo that might conflict
    const existingNonNumericSlNo = await Data.findOne({ 
      slNo: { $not: /^\d{6}$/ } 
    });
    
    if (existingNonNumericSlNo) {
      console.log("Warning: Found existing records with non-numeric slNo. These may cause conflicts.");
    }

    if (!dataType || !data || !Array.isArray(data)) {
      return res.status(400).json({
        success: false,
        message: "Invalid request data. dataType and data array are required.",
      });
    }

    // Get all active staff members
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


         for (const batch of batches) {
       console.log(`Processing batch with ${batch.length} records sequentially...`);
      
       for (let index = 0; index < batch.length; index++) {
         const record = batch[index];
         try {
           
           
           const existingRecord = await Data.findOne({
             mobile: record.mobile,
           });

           if (existingRecord) {
             results.duplicateRecords++;
             continue;
           }

           
           const staffIndex =
             (results.importedRecords + index) % staffMembers.length;
           const assignedStaff = staffMembers[staffIndex]._id;

        
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
    } = req.query;

    const query: any = { isDeleted: false };

    // Apply filters
    if (dataType && dataType !== "all") {
      query.dataType = { $regex: dataType, $options: "i" };
    }

    if (staffId && staffId !== "all") {
      query.assignedStaff = staffId;
    }

    if (status && status !== "all") {
      // General regex search for other statuses
      query.status = { $regex: status, $options: "i" };
    }

    if (dataFilter && dataFilter !== "all") {
      // Enhanced regex patterns for common data types
      query.data = { $regex: dataFilter, $options: "i" };
    }

    // General search across multiple fields
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
    }

    console.log("Query being executed:", JSON.stringify(query, null, 2));
    console.log("Sort object:", JSON.stringify(sortObj, null, 2));
    
    let data;
    let total;
    let pagination;

    if (limit) {
      // With pagination
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
      // Without pagination - get all records
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

    // Prepare update object
    const updateData: any = {
      status: status,
    };

    // Add reminderDateAndTime if provided
    if (reminderDateAndTime) {
      updateData.reminderDateAndTime = new Date(reminderDateAndTime);
    }

    // Update multiple records
    const updateResult = await Data.updateMany(
      {
        _id: { $in: ids },
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
      preferCountry,
      preferJobs,
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
    } = req.body;

    // Validate required fields
    if (!name || !mobile) {
      return res.status(400).json({
        success: false,
        message: "Name and mobile number are required.",
      });
    }

    // Check if mobile number already exists
    const existingRecord = await Data.findOne({ mobile });
    if (existingRecord) {
      return res.status(400).json({
        success: false,
        message: "Mobile number already exists.",
      });
    }

    // Get a staff member to assign (round-robin or first available)
    const staffMember = await Staff.findOne({
      isDeleted: false,
      isActive: true,
    });
    if (!staffMember) {
      return res.status(500).json({
        success: false,
        message: "No staff members available for assignment.",
      });
    }

 
    const slNo = await generateUniqueSlNo();
    const profileId = await generateUniqueProfileId();

    const newData = new Data({
      slNo,
      profileId,
      dataType: "Self",
      data: "register",
      mobile,
      name,
      whatsapp,
      preferCountry,
      preferJobs,
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
      assignedStaff: staffMember?._id,
      isDeleted: false,
      step: 1,
      status: 'in_progress',
    });

    await newData.save();

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
      preferCountry,
      preferJobs,
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
    } = req.body;

    // Validate required fields
    if (!name || !mobile) {
      return res.status(400).json({
        success: false,
        message: "Name and mobile number are required.",
      });
    }

    // Find existing record by mobile number
    const existingRecord = await Data.findOne({ mobile });
    if (!existingRecord) {
      return res.status(404).json({
        success: false,
        message: "Record not found. Please submit the form first.",
      });
    }

    // Prepare update object with only provided fields
    const updateFields: any = {};
    if (whatsapp !== undefined) updateFields.whatsapp = whatsapp;
    if (preferCountry !== undefined) updateFields.preferCountry = preferCountry;
    if (preferJobs !== undefined) updateFields.preferJobs = preferJobs;
    if (searchedHouses !== undefined) updateFields.searchedHouses = searchedHouses;
    if (gender !== undefined) updateFields.gender = gender;
    if (dateOfBirth !== undefined) updateFields.dateOfBirth = dateOfBirth;
    if (maritalStatus !== undefined) updateFields.maritalStatus = maritalStatus;
    if (religion !== undefined) updateFields.religion = religion;
    if (education !== undefined) updateFields.education = education;
    if (jobType !== undefined) updateFields.jobType = jobType;
    if (monthlyIncome !== undefined) updateFields.monthlyIncome = monthlyIncome;
    if (spokenLanguage !== undefined) updateFields.spokenLanguage = spokenLanguage;
    if (district !== undefined) updateFields.district = district;
    if (city !== undefined) updateFields.city = city;
    if (expectations !== undefined) updateFields.expectations = expectations;
    if (createProfileFor !== undefined) updateFields.createProfileFor = createProfileFor;
    if (contactPersonName !== undefined) updateFields.contactPersonName = contactPersonName;
    if (step !== undefined) updateFields.step = step;
    if (status !== undefined) updateFields.status = status;
    if (profilePhoto !== undefined) updateFields.profilePhoto = profilePhoto;

    // Update the record
    const updatedRecord = await Data.findByIdAndUpdate(
      existingRecord._id,
      updateFields,
      { new: true, runValidators: true }
    );

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
      visaPay,
      contactPersonName,
      regReceived,
      payReceived,
      regBalance,
      payBalance,
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
      visaDate,
    } = req.body;
console.log(req.body,"req body");

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Record ID is required",
      });
    }

    // Find the record by ID
    const existingRecord = await Data.findById(id);
    if (!existingRecord) {
      return res.status(404).json({
        success: false,
        message: "Record not found",
      });
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
    if (refferenceNumber !== undefined) updateFields.refferenceNumber = refferenceNumber;
    if (refferenceName !== undefined) updateFields.refferenceName = refferenceName;
    
    // Register specific fields
    if (regPayment !== undefined) updateFields.regPayment = regPayment;
    if (visaPay !== undefined) updateFields.visaPay = visaPay;
    if (contactPersonName !== undefined) updateFields.contactPersonName = contactPersonName;
    if (regReceived !== undefined) updateFields.regReceived = regReceived;
    if (payReceived !== undefined) updateFields.payReceived = payReceived;
    if (regBalance !== undefined) updateFields.regBalance = regBalance;
    if (payBalance !== undefined) updateFields.payBalance = payBalance;
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
    if (searchedHouses !== undefined) updateFields.searchedHouses = searchedHouses;
    if (maritalStatus !== undefined) updateFields.maritalStatus = maritalStatus;
    if (spokenLanguage !== undefined) updateFields.spokenLanguage = spokenLanguage;
    if (processing !== undefined) updateFields.processing = processing;
    if (visaDate !== undefined) updateFields.visaDate = visaDate;

    // Update the record
    const updatedRecord = await Data.findByIdAndUpdate(
      id,
      updateFields,
      { new: true, runValidators: true }
    );

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
