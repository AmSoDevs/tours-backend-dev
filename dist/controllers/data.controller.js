"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateStaffRow = exports.updateStaffRemarks = exports.updateStaffWhatsappClickTime = exports.updateStaffCallClickTime = exports.updateStaffDataStatus = exports.getStaffAssignedData = exports.updateRow = exports.updateForm = exports.submitForm = exports.updateRemarks = exports.updateWhatsappClickTime = exports.updateCallClickTime = exports.updateDataStatus = exports.getData = exports.importData = void 0;
const Data_1 = require("../models/Data");
const Staff_1 = require("../models/Staff");
const helper_1 = require("../utils/helper");
const importData = async (req, res) => {
    try {
        console.log("req.body:", req.body);
        const { dataType, data } = req.body;
        // Check if there are existing records with non-numeric slNo that might conflict
        const existingNonNumericSlNo = await Data_1.Data.findOne({
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
        const staffMembers = await Staff_1.Staff.find({
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
            errors: [],
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
                    const existingRecord = await Data_1.Data.findOne({
                        mobile: record.mobile,
                    });
                    if (existingRecord) {
                        results.duplicateRecords++;
                        continue;
                    }
                    const staffIndex = (results.importedRecords + index) % staffMembers.length;
                    const assignedStaff = staffMembers[staffIndex]._id;
                    const slNo = await (0, helper_1.generateUniqueSlNo)();
                    const profileId = await (0, helper_1.generateUniqueProfileId)();
                    const newData = new Data_1.Data({
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
                }
                catch (error) {
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
    }
    catch (error) {
        console.error("Error importing data:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error during data import",
            error: error.message,
        });
    }
};
exports.importData = importData;
const getData = async (req, res) => {
    try {
        const { page = 1, limit, dataType, staffId, status, data: dataFilter, search, sortBy = "createdAt", sortOrder = "desc", } = req.query;
        const query = { isDeleted: false };
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
        const sortObj = {};
        if (sortBy === "createdAt") {
            sortObj.createdAt = sortOrder === "desc" ? -1 : 1;
        }
        else if (sortBy === "updatedAt") {
            sortObj.updatedAt = sortOrder === "desc" ? -1 : 1;
        }
        else if (sortBy === "name") {
            sortObj.name = sortOrder === "desc" ? -1 : 1;
        }
        else if (sortBy === "mobile") {
            sortObj.mobile = sortOrder === "desc" ? -1 : 1;
        }
        else if (sortBy === "status") {
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
            data = await Data_1.Data.find(query)
                .populate("assignedStaff", "name staffId")
                .sort(sortObj)
                .skip(skip)
                .limit(Number(limit));
            total = await Data_1.Data.countDocuments(query);
            pagination = {
                currentPage: Number(page),
                totalPages: Math.ceil(total / Number(limit)),
                totalRecords: total,
                limit: Number(limit),
            };
        }
        else {
            // Without pagination - get all records
            data = await Data_1.Data.find(query)
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
    }
    catch (error) {
        console.error("Error fetching data:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error while fetching data",
            error: error.message,
        });
    }
};
exports.getData = getData;
const updateDataStatus = async (req, res) => {
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
        const updateData = {
            status: status,
        };
        // Add reminderDateAndTime if provided
        if (reminderDateAndTime) {
            updateData.reminderDateAndTime = new Date(reminderDateAndTime);
        }
        // Update multiple records
        const updateResult = await Data_1.Data.updateMany({
            _id: { $in: ids },
        }, {
            $set: updateData,
        });
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
    }
    catch (error) {
        console.error("Error updating data status:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error while updating status",
            error: error.message,
        });
    }
};
exports.updateDataStatus = updateDataStatus;
const updateCallClickTime = async (req, res) => {
    try {
        const { id, refference } = req.body;
        if (!id) {
            return res.status(400).json({
                success: false,
                message: "Record ID is required.",
            });
        }
        const updateResult = await Data_1.Data.findByIdAndUpdate(id, {
            $set: {
                [refference ? "refferenceCallClickTime" : "callClickTime"]: new Date(),
            },
        }, { new: true });
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
    }
    catch (error) {
        console.error("Error updating call click time:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error while updating call click time",
            error: error.message,
        });
    }
};
exports.updateCallClickTime = updateCallClickTime;
const updateWhatsappClickTime = async (req, res) => {
    try {
        const { id, refference } = req.body;
        if (!id) {
            return res.status(400).json({
                success: false,
                message: "Record ID is required.",
            });
        }
        const updateResult = await Data_1.Data.findByIdAndUpdate(id, {
            $set: {
                [refference ? "refferenceWhatsappClickTime" : "whatsappClickTime"]: new Date(),
            },
        }, { new: true });
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
    }
    catch (error) {
        console.error("Error updating WhatsApp click time:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error while updating WhatsApp click time",
            error: error.message,
        });
    }
};
exports.updateWhatsappClickTime = updateWhatsappClickTime;
const updateRemarks = async (req, res) => {
    try {
        const { id, remarkFirst, remarkSecond } = req.body;
        if (!id) {
            return res.status(400).json({
                success: false,
                message: "Record ID is required.",
            });
        }
        const updateData = {};
        if (remarkFirst !== undefined)
            updateData.remarkFirst = remarkFirst;
        if (remarkSecond !== undefined)
            updateData.remarkSecond = remarkSecond;
        const updateResult = await Data_1.Data.findByIdAndUpdate(id, {
            $set: updateData,
        }, { new: true });
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
    }
    catch (error) {
        console.error("Error updating remarks:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error while updating remarks",
            error: error.message,
        });
    }
};
exports.updateRemarks = updateRemarks;
const submitForm = async (req, res) => {
    try {
        const { name, mobile, whatsapp, preferCountry, preferJobs, searchedHouses, gender, dateOfBirth, maritalStatus, religion, education, jobType, monthlyIncome, spokenLanguage, district, city, expectations, createProfileFor, contactPersonName, } = req.body;
        // Validate required fields
        if (!name || !mobile) {
            return res.status(400).json({
                success: false,
                message: "Name and mobile number are required.",
            });
        }
        // Check if mobile number already exists
        const existingRecord = await Data_1.Data.findOne({ mobile });
        if (existingRecord) {
            return res.status(400).json({
                success: false,
                message: "Mobile number already exists.",
            });
        }
        // Get a staff member to assign (round-robin or first available)
        const staffMember = await Staff_1.Staff.findOne({
            isDeleted: false,
            isActive: true,
        });
        if (!staffMember) {
            return res.status(500).json({
                success: false,
                message: "No staff members available for assignment.",
            });
        }
        const slNo = await (0, helper_1.generateUniqueSlNo)();
        const profileId = await (0, helper_1.generateUniqueProfileId)();
        const newData = new Data_1.Data({
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
    }
    catch (error) {
        console.error("Error submitting form:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error while submitting form",
            error: error.message,
        });
    }
};
exports.submitForm = submitForm;
const updateForm = async (req, res) => {
    try {
        const { name, mobile, whatsapp, preferCountry, preferJobs, searchedHouses, gender, dateOfBirth, maritalStatus, religion, education, jobType, monthlyIncome, spokenLanguage, district, city, expectations, createProfileFor, contactPersonName, step, status, profilePhoto, } = req.body;
        // Validate required fields
        if (!name || !mobile) {
            return res.status(400).json({
                success: false,
                message: "Name and mobile number are required.",
            });
        }
        // Find existing record by mobile number
        const existingRecord = await Data_1.Data.findOne({ mobile });
        if (!existingRecord) {
            return res.status(404).json({
                success: false,
                message: "Record not found. Please submit the form first.",
            });
        }
        // Prepare update object with only provided fields
        const updateFields = {};
        if (whatsapp !== undefined)
            updateFields.whatsapp = whatsapp;
        if (preferCountry !== undefined)
            updateFields.preferCountry = preferCountry;
        if (preferJobs !== undefined)
            updateFields.preferJobs = preferJobs;
        if (searchedHouses !== undefined)
            updateFields.searchedHouses = searchedHouses;
        if (gender !== undefined)
            updateFields.gender = gender;
        if (dateOfBirth !== undefined)
            updateFields.dateOfBirth = dateOfBirth;
        if (maritalStatus !== undefined)
            updateFields.maritalStatus = maritalStatus;
        if (religion !== undefined)
            updateFields.religion = religion;
        if (education !== undefined)
            updateFields.education = education;
        if (jobType !== undefined)
            updateFields.jobType = jobType;
        if (monthlyIncome !== undefined)
            updateFields.monthlyIncome = monthlyIncome;
        if (spokenLanguage !== undefined)
            updateFields.spokenLanguage = spokenLanguage;
        if (district !== undefined)
            updateFields.district = district;
        if (city !== undefined)
            updateFields.city = city;
        if (expectations !== undefined)
            updateFields.expectations = expectations;
        if (createProfileFor !== undefined)
            updateFields.createProfileFor = createProfileFor;
        if (contactPersonName !== undefined)
            updateFields.contactPersonName = contactPersonName;
        if (step !== undefined)
            updateFields.step = step;
        if (status !== undefined)
            updateFields.status = status;
        if (profilePhoto !== undefined)
            updateFields.profilePhoto = profilePhoto;
        // Update the record
        const updatedRecord = await Data_1.Data.findByIdAndUpdate(existingRecord._id, updateFields, { new: true, runValidators: true });
        return res.status(200).json({
            success: true,
            message: "Form updated successfully",
            data: updatedRecord,
        });
    }
    catch (error) {
        console.error("Error updating form:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error while updating form",
            error: error.message,
        });
    }
};
exports.updateForm = updateForm;
const updateRow = async (req, res) => {
    try {
        const { id, mobile, name, status, remarkFirst, remarkSecond, verified, dataType, refferenceNumber, refferenceName, 
        // Register specific fields
        regPayment, visaPay, contactPersonName, regReceived, payReceived, regBalance, payBalance, passportNo, vSampleSend, expectations, district, education, preferCountry, city, jobType, preferJobs, religion, monthlyIncome, searchedHouses, maritalStatus, spokenLanguage, processing, visaDate, } = req.body;
        console.log(req.body, "req body");
        if (!id) {
            return res.status(400).json({
                success: false,
                message: "Record ID is required",
            });
        }
        // Find the record by ID
        const existingRecord = await Data_1.Data.findById(id);
        if (!existingRecord) {
            return res.status(404).json({
                success: false,
                message: "Record not found",
            });
        }
        // Prepare update object with only provided fields
        const updateFields = {};
        if (mobile !== undefined)
            updateFields.mobile = mobile;
        if (name !== undefined)
            updateFields.name = name;
        if (status !== undefined)
            updateFields.status = status;
        if (remarkFirst !== undefined)
            updateFields.remarkFirst = remarkFirst;
        if (remarkSecond !== undefined)
            updateFields.remarkSecond = remarkSecond;
        if (verified !== undefined)
            updateFields.verified = verified;
        if (dataType !== undefined)
            updateFields.dataType = dataType;
        if (refferenceNumber !== undefined)
            updateFields.refferenceNumber = refferenceNumber;
        if (refferenceName !== undefined)
            updateFields.refferenceName = refferenceName;
        // Register specific fields
        if (regPayment !== undefined)
            updateFields.regPayment = regPayment;
        if (visaPay !== undefined)
            updateFields.visaPay = visaPay;
        if (contactPersonName !== undefined)
            updateFields.contactPersonName = contactPersonName;
        if (regReceived !== undefined)
            updateFields.regReceived = regReceived;
        if (payReceived !== undefined)
            updateFields.payReceived = payReceived;
        if (regBalance !== undefined)
            updateFields.regBalance = regBalance;
        if (payBalance !== undefined)
            updateFields.payBalance = payBalance;
        if (passportNo !== undefined)
            updateFields.passportNo = passportNo;
        if (vSampleSend !== undefined)
            updateFields.vSampleSend = vSampleSend;
        if (expectations !== undefined)
            updateFields.expectations = expectations;
        if (district !== undefined)
            updateFields.district = district;
        if (education !== undefined)
            updateFields.education = education;
        if (preferCountry !== undefined)
            updateFields.preferCountry = preferCountry;
        if (city !== undefined)
            updateFields.city = city;
        if (jobType !== undefined)
            updateFields.jobType = jobType;
        if (preferJobs !== undefined)
            updateFields.preferJobs = preferJobs;
        if (religion !== undefined)
            updateFields.religion = religion;
        if (monthlyIncome !== undefined)
            updateFields.monthlyIncome = monthlyIncome;
        if (searchedHouses !== undefined)
            updateFields.searchedHouses = searchedHouses;
        if (maritalStatus !== undefined)
            updateFields.maritalStatus = maritalStatus;
        if (spokenLanguage !== undefined)
            updateFields.spokenLanguage = spokenLanguage;
        if (processing !== undefined)
            updateFields.processing = processing;
        if (visaDate !== undefined)
            updateFields.visaDate = visaDate;
        // Update the record
        const updatedRecord = await Data_1.Data.findByIdAndUpdate(id, updateFields, { new: true, runValidators: true });
        return res.status(200).json({
            success: true,
            message: "Record updated successfully",
            data: updatedRecord,
        });
    }
    catch (error) {
        console.error("Error updating row:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error while updating record",
            error: error.message,
        });
    }
};
exports.updateRow = updateRow;
const getStaffAssignedData = async (req, res) => {
    try {
        const { id: staffId } = req.params;
        const { page = 1, limit, dataType, status, data: dataFilter, search, sortBy = "createdAt", sortOrder = "desc", } = req.query;
        const query = {
            isDeleted: false,
            assignedStaff: staffId
        };
        // Apply filters
        if (dataType && dataType !== "all") {
            query.dataType = { $regex: dataType, $options: "i" };
        }
        if (status && status !== "all") {
            query.status = { $regex: status, $options: "i" };
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
        const sortObj = {};
        if (sortBy === "createdAt") {
            sortObj.createdAt = sortOrder === "desc" ? -1 : 1;
        }
        else if (sortBy === "updatedAt") {
            sortObj.updatedAt = sortOrder === "desc" ? -1 : 1;
        }
        else if (sortBy === "name") {
            sortObj.name = sortOrder === "desc" ? -1 : 1;
        }
        else if (sortBy === "mobile") {
            sortObj.mobile = sortOrder === "desc" ? -1 : 1;
        }
        else if (sortBy === "status") {
            sortObj.status = sortOrder === "desc" ? -1 : 1;
        }
        let data;
        let total;
        let pagination;
        if (limit) {
            const skip = (Number(page) - 1) * Number(limit);
            data = await Data_1.Data.find(query)
                .populate("assignedStaff", "name staffId")
                .sort(sortObj)
                .skip(skip)
                .limit(Number(limit));
            total = await Data_1.Data.countDocuments(query);
            pagination = {
                currentPage: Number(page),
                totalPages: Math.ceil(total / Number(limit)),
                totalRecords: total,
                limit: Number(limit),
            };
        }
        else {
            data = await Data_1.Data.find(query)
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
    }
    catch (error) {
        console.error("Error fetching staff assigned data:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error while fetching staff assigned data",
            error: error.message,
        });
    }
};
exports.getStaffAssignedData = getStaffAssignedData;
// Staff-specific update functions that verify data ownership
const updateStaffDataStatus = async (req, res) => {
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
        const records = await Data_1.Data.find({
            _id: { $in: ids },
            assignedStaff: staffId,
            isDeleted: false
        });
        if (records.length !== ids.length) {
            return res.status(403).json({
                success: false,
                message: "Some records are not assigned to you or do not exist.",
            });
        }
        // Prepare update object
        const updateData = {
            status: status,
        };
        // Add reminderDateAndTime if provided
        if (reminderDateAndTime) {
            updateData.reminderDateAndTime = new Date(reminderDateAndTime);
        }
        // Update only the verified records
        const updateResult = await Data_1.Data.updateMany({
            _id: { $in: ids },
            assignedStaff: staffId,
            isDeleted: false
        }, {
            $set: updateData,
        });
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
    }
    catch (error) {
        console.error("Error updating staff data status:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error while updating status",
            error: error.message,
        });
    }
};
exports.updateStaffDataStatus = updateStaffDataStatus;
const updateStaffCallClickTime = async (req, res) => {
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
        const record = await Data_1.Data.findOne({
            _id: id,
            assignedStaff: staffId,
            isDeleted: false
        });
        if (!record) {
            return res.status(403).json({
                success: false,
                message: "Record not found or not assigned to you.",
            });
        }
        const updateResult = await Data_1.Data.findByIdAndUpdate(id, {
            $set: {
                [refference ? "refferenceCallClickTime" : "callClickTime"]: new Date(),
            },
        }, { new: true });
        return res.status(200).json({
            success: true,
            message: "Call click time updated successfully",
            data: updateResult,
        });
    }
    catch (error) {
        console.error("Error updating staff call click time:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error while updating call click time",
            error: error.message,
        });
    }
};
exports.updateStaffCallClickTime = updateStaffCallClickTime;
const updateStaffWhatsappClickTime = async (req, res) => {
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
        const record = await Data_1.Data.findOne({
            _id: id,
            assignedStaff: staffId,
            isDeleted: false
        });
        if (!record) {
            return res.status(403).json({
                success: false,
                message: "Record not found or not assigned to you.",
            });
        }
        const updateResult = await Data_1.Data.findByIdAndUpdate(id, {
            $set: {
                [refference ? "refferenceWhatsappClickTime" : "whatsappClickTime"]: new Date(),
            },
        }, { new: true });
        return res.status(200).json({
            success: true,
            message: "WhatsApp click time updated successfully",
            data: updateResult,
        });
    }
    catch (error) {
        console.error("Error updating staff WhatsApp click time:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error while updating WhatsApp click time",
            error: error.message,
        });
    }
};
exports.updateStaffWhatsappClickTime = updateStaffWhatsappClickTime;
const updateStaffRemarks = async (req, res) => {
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
        const record = await Data_1.Data.findOne({
            _id: id,
            assignedStaff: staffId,
            isDeleted: false
        });
        if (!record) {
            return res.status(403).json({
                success: false,
                message: "Record not found or not assigned to you.",
            });
        }
        const updateData = {};
        if (remarkFirst !== undefined)
            updateData.remarkFirst = remarkFirst;
        if (remarkSecond !== undefined)
            updateData.remarkSecond = remarkSecond;
        const updateResult = await Data_1.Data.findByIdAndUpdate(id, {
            $set: updateData,
        }, { new: true });
        return res.status(200).json({
            success: true,
            message: "Remarks updated successfully",
            data: updateResult,
        });
    }
    catch (error) {
        console.error("Error updating staff remarks:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error while updating remarks",
            error: error.message,
        });
    }
};
exports.updateStaffRemarks = updateStaffRemarks;
const updateStaffRow = async (req, res) => {
    try {
        const { id: staffId } = req.params;
        const { id, mobile, name, status, remarkFirst, remarkSecond, verified, dataType, refferenceNumber, refferenceName, 
        // Register specific fields
        regPayment, visaPay, contactPersonName, regReceived, payReceived, regBalance, payBalance, passportNo, vSampleSend, expectations, district, education, preferCountry, city, jobType, preferJobs, religion, monthlyIncome, searchedHouses, maritalStatus, spokenLanguage, processing, visaDate, } = req.body;
        if (!id) {
            return res.status(400).json({
                success: false,
                message: "Record ID is required",
            });
        }
        // Verify that the record belongs to the staff member
        const record = await Data_1.Data.findOne({
            _id: id,
            assignedStaff: staffId,
            isDeleted: false
        });
        if (!record) {
            return res.status(403).json({
                success: false,
                message: "Record not found or not assigned to you.",
            });
        }
        // Prepare update object with only provided fields
        const updateFields = {};
        if (mobile !== undefined)
            updateFields.mobile = mobile;
        if (name !== undefined)
            updateFields.name = name;
        if (status !== undefined)
            updateFields.status = status;
        if (remarkFirst !== undefined)
            updateFields.remarkFirst = remarkFirst;
        if (remarkSecond !== undefined)
            updateFields.remarkSecond = remarkSecond;
        if (verified !== undefined)
            updateFields.verified = verified;
        if (dataType !== undefined)
            updateFields.dataType = dataType;
        if (refferenceNumber !== undefined)
            updateFields.refferenceNumber = refferenceNumber;
        if (refferenceName !== undefined)
            updateFields.refferenceName = refferenceName;
        // Register specific fields
        if (regPayment !== undefined)
            updateFields.regPayment = regPayment;
        if (visaPay !== undefined)
            updateFields.visaPay = visaPay;
        if (contactPersonName !== undefined)
            updateFields.contactPersonName = contactPersonName;
        if (regReceived !== undefined)
            updateFields.regReceived = regReceived;
        if (payReceived !== undefined)
            updateFields.payReceived = payReceived;
        if (regBalance !== undefined)
            updateFields.regBalance = regBalance;
        if (payBalance !== undefined)
            updateFields.payBalance = payBalance;
        if (passportNo !== undefined)
            updateFields.passportNo = passportNo;
        if (vSampleSend !== undefined)
            updateFields.vSampleSend = vSampleSend;
        if (expectations !== undefined)
            updateFields.expectations = expectations;
        if (district !== undefined)
            updateFields.district = district;
        if (education !== undefined)
            updateFields.education = education;
        if (preferCountry !== undefined)
            updateFields.preferCountry = preferCountry;
        if (city !== undefined)
            updateFields.city = city;
        if (jobType !== undefined)
            updateFields.jobType = jobType;
        if (preferJobs !== undefined)
            updateFields.preferJobs = preferJobs;
        if (religion !== undefined)
            updateFields.religion = religion;
        if (monthlyIncome !== undefined)
            updateFields.monthlyIncome = monthlyIncome;
        if (searchedHouses !== undefined)
            updateFields.searchedHouses = searchedHouses;
        if (maritalStatus !== undefined)
            updateFields.maritalStatus = maritalStatus;
        if (spokenLanguage !== undefined)
            updateFields.spokenLanguage = spokenLanguage;
        if (processing !== undefined)
            updateFields.processing = processing;
        if (visaDate !== undefined)
            updateFields.visaDate = visaDate;
        // Update the record
        const updatedRecord = await Data_1.Data.findByIdAndUpdate(id, updateFields, { new: true, runValidators: true });
        return res.status(200).json({
            success: true,
            message: "Record updated successfully",
            data: updatedRecord,
        });
    }
    catch (error) {
        console.error("Error updating staff row:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error while updating record",
            error: error.message,
        });
    }
};
exports.updateStaffRow = updateStaffRow;
//# sourceMappingURL=data.controller.js.map