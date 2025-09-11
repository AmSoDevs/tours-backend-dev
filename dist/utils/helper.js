"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateUniqueTrackingId = exports.resetStaffAssignmentIfNeeded = exports.checkExistingStaffIds = exports.generateUniqueStaffId = exports.generateUniqueProfileId = exports.generateUniqueSlNo = void 0;
const Data_1 = require("../models/Data");
const FormTracking_1 = require("../models/FormTracking");
const Staff_1 = require("../models/Staff");
const StaffAssignment_1 = require("../models/StaffAssignment");
const generateUniqueSlNo = async () => {
    try {
        const highestRecord = await Data_1.Data.findOne({
            slNo: { $regex: /^\d{6}$/ },
        }, {}, { sort: { slNo: -1 } });
        let nextNumber = 1;
        if (highestRecord && highestRecord.slNo) {
            const currentNumber = parseInt(highestRecord.slNo, 10);
            if (!isNaN(currentNumber)) {
                nextNumber = currentNumber + 1;
            }
        }
        const slNo = nextNumber.toString().padStart(6, "0");
        const existingRecord = await Data_1.Data.findOne({ slNo });
        if (existingRecord) {
            return (nextNumber + 1).toString().padStart(6, "0");
        }
        return slNo;
    }
    catch (error) {
        console.error("Error generating slNo:", error);
        const timestamp = Date.now().toString().slice(-6);
        return timestamp;
    }
};
exports.generateUniqueSlNo = generateUniqueSlNo;
const generateUniqueProfileId = async () => {
    try {
        let attempts = 0;
        const maxAttempts = 50;
        while (attempts < maxAttempts) {
            const randomNumber = Math.floor(Math.random() * 900000) + 100000;
            const profileId = randomNumber.toString();
            const existingRecord = await Data_1.Data.findOne({ profileId });
            if (!existingRecord) {
                return profileId;
            }
            attempts++;
        }
        const timestamp = Date.now().toString().slice(-6);
        return timestamp;
    }
    catch (error) {
        console.error("Error generating profileId:", error);
        const timestamp = Date.now().toString().slice(-6);
        return timestamp;
    }
};
exports.generateUniqueProfileId = generateUniqueProfileId;
const generateUniqueStaffId = async (workType) => {
    try {
        const prefix = workType.charAt(0).toUpperCase();
        const highestRecord = await Staff_1.Staff.findOne({
            staffId: { $regex: new RegExp(`^${prefix}\\d+$`) },
            isDeleted: false,
        }, {}, { sort: { staffId: -1 } });
        let nextNumber = 1;
        if (highestRecord && highestRecord.staffId) {
            const numberPart = highestRecord.staffId.replace(/^[A-Z]/, "");
            const currentNumber = parseInt(numberPart, 10);
            if (!isNaN(currentNumber)) {
                nextNumber = currentNumber + 1;
            }
        }
        return `${prefix}${nextNumber}`;
    }
    catch (error) {
        console.error("Error generating staffId:", error);
        const prefix = workType.charAt(0).toUpperCase();
        const timestamp = Date.now().toString().slice(-4);
        return `${prefix}${timestamp}`;
    }
};
exports.generateUniqueStaffId = generateUniqueStaffId;
const checkExistingStaffIds = async () => {
    try {
        const homeStaff = await Staff_1.Staff.find({
            workType: "home",
            isDeleted: false,
        })
            .select("staffId name")
            .sort({ staffId: 1 });
        const officeStaff = await Staff_1.Staff.find({
            workType: "office",
            isDeleted: false,
        })
            .select("staffId name")
            .sort({ staffId: 1 });
    }
    catch (error) {
        console.error("Error checking existing staff IDs:", error);
    }
};
exports.checkExistingStaffIds = checkExistingStaffIds;
const resetStaffAssignmentIfNeeded = async () => {
    try {
        const staffAssignment = await StaffAssignment_1.StaffAssignment.findOne();
        if (staffAssignment) {
            staffAssignment.lastAssignedStaffIndex = -1;
            await staffAssignment.save();
        }
    }
    catch (error) {
        console.error("Error resetting staff assignment:", error);
    }
};
exports.resetStaffAssignmentIfNeeded = resetStaffAssignmentIfNeeded;
const generateUniqueTrackingId = async () => {
    try {
        let attempts = 0;
        const maxAttempts = 50;
        while (attempts < maxAttempts) {
            // Generate 10-character alphanumeric tracking ID (letters + digits)
            const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
            let trackingId = '';
            for (let i = 0; i < 10; i++) {
                trackingId += characters.charAt(Math.floor(Math.random() * characters.length));
            }
            const existingRecord = await FormTracking_1.FormTracking.findOne({ trackingId });
            if (!existingRecord) {
                return trackingId;
            }
            attempts++;
        }
        // Fallback: use timestamp with alphanumeric characters
        const timestamp = Date.now().toString().slice(-6);
        const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let fallbackId = '';
        for (let i = 0; i < 4; i++) {
            fallbackId += characters.charAt(Math.floor(Math.random() * characters.length));
        }
        return fallbackId + timestamp;
    }
    catch (error) {
        console.error("Error generating trackingId:", error);
        // Fallback: use timestamp with alphanumeric characters
        const timestamp = Date.now().toString().slice(-6);
        const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let fallbackId = '';
        for (let i = 0; i < 4; i++) {
            fallbackId += characters.charAt(Math.floor(Math.random() * characters.length));
        }
        return fallbackId + timestamp;
    }
};
exports.generateUniqueTrackingId = generateUniqueTrackingId;
//# sourceMappingURL=helper.js.map