"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.trackFormShare = trackFormShare;
const zod_1 = require("zod");
const mongoose_1 = __importDefault(require("mongoose"));
const FormTracking_1 = require("../models/FormTracking");
const Status_1 = require("../models/Status");
const Data_1 = require("../models/Data"); // 👈 Added
const helper_1 = require("../utils/helper");
const trackFormShareSchema = zod_1.z.object({
    formType: zod_1.z.string().min(1),
    staffId: zod_1.z.string().min(1),
    dataId: zod_1.z.string().optional(),
    isReference: zod_1.z.boolean().optional(),
    allowMultiple: zod_1.z.boolean().optional(),
});
async function trackFormShare(req, res) {
    try {
        const parsed = trackFormShareSchema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json({
                success: false,
                message: "Invalid payload",
                errors: parsed.error.flatten(),
            });
            return;
        }
        const { formType, staffId, dataId, isReference, allowMultiple } = parsed.data;
        // 1️⃣ Create or reuse tracking record
        let existing = await FormTracking_1.FormTracking.findOne({ dataId, staffId, formType, isReference, allowMultiple });
        if (!existing) {
            const trackingId = await (0, helper_1.generateUniqueTrackingId)();
            existing = await FormTracking_1.FormTracking.create({
                trackingId,
                formType,
                staffId,
                dataId,
                isReference,
                allowMultiple,
                status: "shared",
                sharedAt: new Date(),
                currentStep: 0,
            });
        }
        // 2️⃣ Update the actual Data record (the one shown in /data)
        if (dataId && mongoose_1.default.Types.ObjectId.isValid(dataId)) {
            const reminderDateAndTime = new Date().toISOString();
            console.log("📤 Updating Data record:", dataId);
            const updated = await Data_1.Data.findByIdAndUpdate(dataId, {
                $set: {
                    status: "Success",
                    reminderDateAndTime,
                },
            }, { new: true, strict: false });
            if (updated) {
                console.log(`✅ Data record ${dataId} updated to "Success"`);
            }
            else {
                console.log("⚠️ No matching Data record found to update");
            }
        }
        // 3️⃣ (Optional) Also sync general Status by formType
        await Status_1.Status.updateOne({ dataType: formType, isDeleted: false }, { $set: { name: "Success" } }, { upsert: true, strict: false });
        res.status(201).json({
            success: true,
            message: "Form share tracked and Data record updated to Success",
            data: existing.trackingId,
        });
    }
    catch (error) {
        console.error("❌ Error tracking form share:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error while tracking form share",
            error: error.message,
        });
    }
}
//# sourceMappingURL=formTracking.controller.js.map