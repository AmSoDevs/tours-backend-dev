"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createStaff = createStaff;
exports.listStaff = listStaff;
exports.getStaff = getStaff;
exports.updateStaff = updateStaff;
exports.softDeleteStaff = softDeleteStaff;
const zod_1 = require("zod");
const Staff_1 = require("../models/Staff");
const helper_1 = require("../utils/helper");
const createSchema = zod_1.z.object({
    name: zod_1.z.string().min(1),
    email: zod_1.z.string().email(),
    username: zod_1.z.string().min(3),
    gender: zod_1.z.enum(["male", "female", "other"]),
    dateOfBirth: zod_1.z.string().transform((v) => new Date(v)),
    qualification: zod_1.z.string().min(1),
    salary: zod_1.z.number().nonnegative(),
    workType: zod_1.z.enum(["home", "office"]),
    whatsappNumber: zod_1.z.string().min(6),
    gpayNumber: zod_1.z.string().min(6),
    password: zod_1.z.string().min(6),
    isActive: zod_1.z.boolean().default(true),
});
const updateSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).optional(),
    email: zod_1.z.string().email().optional(),
    isActive: zod_1.z.boolean().optional(),
    username: zod_1.z.string().min(3).optional(),
    gender: zod_1.z.enum(["male", "female", "other"]).optional(),
    dateOfBirth: zod_1.z.string().transform((v) => new Date(v)).optional(),
    qualification: zod_1.z.string().min(1).optional(),
    salary: zod_1.z.number().nonnegative().optional(),
    workType: zod_1.z.enum(["home", "office"]).optional(),
    whatsappNumber: zod_1.z.string().min(6).optional(),
    gpayNumber: zod_1.z.string().min(6).optional(),
    password: zod_1.z.string().min(6).optional(),
});
function presentStaff(staff) {
    return {
        id: String(staff._id),
        staffId: staff.staffId,
        name: staff.name,
        email: staff.email,
        username: staff.username,
        password: staff.password,
        gender: staff.gender,
        dateOfBirth: staff.dateOfBirth,
        qualification: staff.qualification,
        salary: staff.salary,
        workType: staff.workType,
        whatsappNumber: staff.whatsappNumber,
        gpayNumber: staff.gpayNumber,
        role: staff.role,
        createdAt: staff.createdAt,
        isActive: staff.isActive,
    };
}
async function createStaff(req, res) {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ success: false, message: "Invalid payload", errors: parsed.error.flatten() });
        return;
    }
    const { password, ...data } = parsed.data;
    const conflict = await Staff_1.Staff.findOne({ $or: [{ email: data.email }, { username: data.username }] });
    if (conflict) {
        res.status(409).json({ success: false, message: "Email or username already in use" });
        return;
    }
    const staffId = await (0, helper_1.generateUniqueStaffId)(data.workType);
    const staff = await Staff_1.Staff.create({ ...data, staffId, password, isActive: data.isActive ?? true });
    res.status(201).json({ success: true, staff: presentStaff(staff) });
}
async function listStaff(_req, res) {
    const staff = await Staff_1.Staff.find({ isDeleted: false }, {
        name: 1,
        email: 1,
        username: 1,
        gender: 1,
        dateOfBirth: 1,
        qualification: 1,
        salary: 1,
        workType: 1,
        whatsappNumber: 1,
        gpayNumber: 1,
        role: 1,
        staffId: 1,
        createdAt: 1,
        isActive: 1,
        password: 1,
    }).sort({ createdAt: -1 });
    await (0, helper_1.checkExistingStaffIds)();
    res.json({ success: true, staff: staff.map(presentStaff) });
}
async function getStaff(req, res) {
    const { id } = req.params;
    const staff = await Staff_1.Staff.findById(id, {
        name: 1,
        email: 1,
        username: 1,
        gender: 1,
        dateOfBirth: 1,
        qualification: 1,
        salary: 1,
        workType: 1,
        whatsappNumber: 1,
        gpayNumber: 1,
        role: 1,
        staffId: 1,
        isActive: 1,
        password: 1,
    });
    if (!staff) {
        res.status(404).json({ success: false, message: "Staff not found" });
        return;
    }
    res.json({ success: true, staff: presentStaff(staff) });
}
async function updateStaff(req, res) {
    const { id } = req.params;
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ success: false, message: "Invalid payload", errors: parsed.error.flatten() });
        return;
    }
    console.log(req.body);
    const d = parsed.data;
    if (d.email !== undefined || d.username !== undefined) {
        const conflictQuery = { _id: { $ne: id } };
        const orConditions = [];
        if (d.email !== undefined) {
            orConditions.push({ email: d.email });
        }
        if (d.username !== undefined) {
            orConditions.push({ username: d.username });
        }
        if (orConditions.length > 0) {
            conflictQuery.$or = orConditions;
            const conflict = await Staff_1.Staff.findOne(conflictQuery);
            if (conflict) {
                res.status(409).json({ success: false, message: "Email or username already in use" });
                return;
            }
        }
    }
    const updates = {};
    if (d.name !== undefined)
        updates.name = d.name;
    if (d.email !== undefined)
        updates.email = d.email;
    if (d.username !== undefined)
        updates.username = d.username;
    if (d.gender !== undefined)
        updates.gender = d.gender;
    if (d.dateOfBirth !== undefined)
        updates.dateOfBirth = d.dateOfBirth;
    if (d.qualification !== undefined)
        updates.qualification = d.qualification;
    if (d.salary !== undefined)
        updates.salary = d.salary;
    if (d.workType !== undefined)
        updates.workType = d.workType;
    if (d.whatsappNumber !== undefined)
        updates.whatsappNumber = d.whatsappNumber;
    if (d.gpayNumber !== undefined)
        updates.gpayNumber = d.gpayNumber;
    if (d.password !== undefined)
        updates.password = d.password;
    if (d.isActive !== undefined)
        updates.isActive = d.isActive;
    const staff = await Staff_1.Staff.findByIdAndUpdate({ _id: id }, updates, { new: true, projection: {
            name: 1, isActive: 1, email: 1, username: 1, password: 1, gender: 1, dateOfBirth: 1, qualification: 1, salary: 1, workType: 1, whatsappNumber: 1, gpayNumber: 1, role: 1, staffId: 1, createdAt: 1
        } });
    if (!staff) {
        res.status(404).json({ success: false, message: "Staff not found" });
        return;
    }
    if (d.isActive !== undefined) {
        await (0, helper_1.resetStaffAssignmentIfNeeded)();
    }
    res.json({ success: true, staff: presentStaff(staff) });
}
async function softDeleteStaff(req, res) {
    const { id } = req.params;
    const staff = await Staff_1.Staff.findByIdAndUpdate(id, { isDeleted: true }, { new: true });
    if (!staff) {
        res.status(404).json({ success: false, message: "Staff not found" });
        return;
    }
    await (0, helper_1.resetStaffAssignmentIfNeeded)();
    res.status(200).json({ success: true });
}
//# sourceMappingURL=staff.controller.js.map