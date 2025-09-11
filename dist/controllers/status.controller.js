"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createStatus = createStatus;
exports.listStatuses = listStatuses;
exports.getStatus = getStatus;
exports.updateStatus = updateStatus;
exports.softDeleteStatus = softDeleteStatus;
const zod_1 = require("zod");
const Status_1 = require("../models/Status");
const mongoose_1 = __importDefault(require("mongoose"));
const createSchema = zod_1.z.object({
    name: zod_1.z.string().min(1),
    dataType: zod_1.z.string().min(1),
    color: zod_1.z.string().min(1),
});
const updateSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).optional(),
    dataType: zod_1.z.string().min(1).optional(),
    color: zod_1.z.string().min(1).optional(),
    isDeleted: zod_1.z.boolean().optional(),
});
function presentStatus(s) {
    return {
        id: String(s._id),
        name: s.name,
        dataType: s.dataType,
        color: s.color,
    };
}
async function createStatus(req, res) {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ success: false, message: "Invalid payload", errors: parsed.error.flatten() });
        return;
    }
    const payload = parsed.data;
    // Prevent duplicates by name (case-insensitive) among non-deleted
    const existing = await Status_1.Status.findOne({ name: { $regex: `^${payload.name}$`, $options: "i" }, dataType: payload?.dataType, isDeleted: false });
    if (existing) {
        res.status(409).json({ success: false, message: "Status name already exists for this data type" });
        return;
    }
    const status = await Status_1.Status.create({ name: payload.name, dataType: payload.dataType, color: payload.color });
    res.status(201).json({ success: true, status: presentStatus(status) });
}
async function listStatuses(_req, res) {
    const statuses = await Status_1.Status.find({ isDeleted: false }).sort({ createdAt: -1 });
    res.json({ success: true, statuses: statuses.map(presentStatus) });
}
async function getStatus(req, res) {
    const { id } = req.params;
    const status = await Status_1.Status.findById(id);
    if (!status || status.isDeleted) {
        res.status(404).json({ success: false, message: "Status not found" });
        return;
    }
    res.json({ success: true, status: presentStatus(status) });
}
async function updateStatus(req, res) {
    const { id } = req.params;
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ success: false, message: "Invalid payload", errors: parsed.error.flatten() });
        return;
    }
    const updates = {};
    const d = parsed.data;
    if (d.name !== undefined) {
        const existing = await Status_1.Status.findOne({ _id: { $ne: id }, name: { $regex: `^${d.name}$`, $options: "i" }, dataType: d?.dataType, isDeleted: false });
        if (existing) {
            res.status(409).json({ success: false, message: "Status name already exists for this data type" });
            return;
        }
        updates.name = d.name;
    }
    if (d.dataType !== undefined)
        updates.dataType = d.dataType;
    if (d.color !== undefined)
        updates.color = d.color;
    if (d.isDeleted !== undefined)
        updates.isDeleted = d.isDeleted;
    const status = await Status_1.Status.findByIdAndUpdate(id, updates, { new: true });
    if (!status) {
        res.status(404).json({ success: false, message: "Status not found" });
        return;
    }
    res.json({ success: true, status: presentStatus(status) });
}
async function softDeleteStatus(req, res) {
    const { id } = req.params;
    if (!id || !mongoose_1.default.Types.ObjectId.isValid(id)) {
        res.status(400).json({ success: false, message: "Invalid id" });
        return;
    }
    const status = await Status_1.Status.findByIdAndUpdate(id, { isDeleted: true }, { new: true });
    if (!status) {
        res.status(404).json({ success: false, message: "Status not found" });
        return;
    }
    res.status(200).json({ success: true });
}
//# sourceMappingURL=status.controller.js.map