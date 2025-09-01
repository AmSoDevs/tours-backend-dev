import { Request, Response } from "express";
import { Data } from "../models/Data";
import { Staff } from "../models/Staff";
import { generateUniqueProfileId, generateUniqueSlNo } from "../utils/helper";

export const importData = async (req: Request, res: Response) => {
  try {
    console.log("req.body:", req.body);

    const { dataType, data } = req.body;

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

    // Process data in batches to handle large imports efficiently
    const batchSize = 100;
    const batches = [];

    for (let i = 0; i < data.length; i += batchSize) {
      batches.push(data.slice(i, i + batchSize));
    }

    for (const batch of batches) {
      const batchPromises = batch.map(async (record: any, index: number) => {
        try {
          const existingRecord = await Data.findOne({
            mobile: record.mobile,
          });

          if (existingRecord) {
            results.duplicateRecords++;
            return { success: false, reason: "duplicate", record };
          }

          // Assign staff member using round-robin distribution
          const staffIndex =
            (results.importedRecords + index) % staffMembers.length;
          const assignedStaff = staffMembers[staffIndex]._id;

          // Create new data record
          const newData = new Data({
            slNo: record.slNo,
            dataType: record?.dataType,
            data: dataType,
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
          return { success: true, record: newData };
        } catch (error: any) {
          const errorMessage = `Error processing record ${record.slNo}: ${error.message}`;
          results.errors.push(errorMessage);
          return {
            success: false,
            reason: "error",
            record,
            error: errorMessage,
          };
        }
      });

      await Promise.all(batchPromises);
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
      limit = 10,
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

    const skip = (Number(page) - 1) * Number(limit);

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
    
    const data = await Data.find(query)
      .populate("assignedStaff", "name staffId")
      .sort(sortObj)
      .skip(skip)
      .limit(Number(limit));

    const total = await Data.countDocuments(query);

    return res.status(200).json({
      success: true,
      data,
      pagination: {
        currentPage: Number(page),
        totalPages: Math.ceil(total / Number(limit)),
        totalRecords: total,
        limit: Number(limit),
      },
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
