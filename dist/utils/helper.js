"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkExistingStaffIds = exports.generateUniqueStaffId = exports.generateUniqueProfileId = exports.generateUniqueSlNo = void 0;
const Data_1 = require("../models/Data");
const Staff_1 = require("../models/Staff");
const generateUniqueSlNo = async () => {
    try {
        const highestRecord = await Data_1.Data.findOne({
            slNo: { $regex: /^\d{6}$/ }
        }, {}, { sort: { slNo: -1 } });
        let nextNumber = 1;
        if (highestRecord && highestRecord.slNo) {
            const currentNumber = parseInt(highestRecord.slNo, 10);
            if (!isNaN(currentNumber)) {
                nextNumber = currentNumber + 1;
            }
        }
        const slNo = nextNumber.toString().padStart(6, '0');
        const existingRecord = await Data_1.Data.findOne({ slNo });
        if (existingRecord) {
            return (nextNumber + 1).toString().padStart(6, '0');
        }
        return slNo;
    }
    catch (error) {
        console.error('Error generating slNo:', error);
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
        console.error('Error generating profileId:', error);
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
            isDeleted: false
        }, {}, { sort: { staffId: -1 } });
        let nextNumber = 1;
        if (highestRecord && highestRecord.staffId) {
            const numberPart = highestRecord.staffId.replace(/^[A-Z]/, '');
            const currentNumber = parseInt(numberPart, 10);
            if (!isNaN(currentNumber)) {
                nextNumber = currentNumber + 1;
            }
        }
        return `${prefix}${nextNumber}`;
    }
    catch (error) {
        console.error('Error generating staffId:', error);
        const prefix = workType.charAt(0).toUpperCase();
        const timestamp = Date.now().toString().slice(-4);
        return `${prefix}${timestamp}`;
    }
};
exports.generateUniqueStaffId = generateUniqueStaffId;
const checkExistingStaffIds = async () => {
    try {
        const homeStaff = await Staff_1.Staff.find({
            workType: 'home',
            isDeleted: false
        }).select('staffId name').sort({ staffId: 1 });
        const officeStaff = await Staff_1.Staff.find({
            workType: 'office',
            isDeleted: false
        }).select('staffId name').sort({ staffId: 1 });
        console.log('=== Existing Staff ID Patterns ===');
        console.log('Home Staff:', homeStaff.map(s => `${s.staffId} (${s.name})`));
        console.log('Office Staff:', officeStaff.map(s => `${s.staffId} (${s.name})`));
        console.log('==================================');
    }
    catch (error) {
        console.error('Error checking existing staff IDs:', error);
    }
};
exports.checkExistingStaffIds = checkExistingStaffIds;
//# sourceMappingURL=helper.js.map