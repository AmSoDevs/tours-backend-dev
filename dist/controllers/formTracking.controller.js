"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.trackFormShare = trackFormShare;
exports.updateFormSubmission = updateFormSubmission;
const zod_1 = require("zod");
const FormTracking_1 = require("../models/FormTracking");
const trackFormShareSchema = zod_1.z.object({
    trackingId: zod_1.z.string().min(1),
    formType: zod_1.z.string().min(1),
    staffId: zod_1.z.string().min(1),
    staffName: zod_1.z.string().min(1),
    dataType: zod_1.z.string().min(1),
});
const updateFormSubmissionSchema = zod_1.z.object({
    trackingId: zod_1.z.string().min(1),
    submittedData: zod_1.z.any(),
});
async function trackFormShare(req, res) {
    try {
        const parsed = trackFormShareSchema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json({
                success: false,
                message: "Invalid payload",
                errors: parsed.error.flatten()
            });
            return;
        }
        const { trackingId, formType, staffId, staffName, dataType } = parsed.data;
        // Check if tracking ID already exists
        const existing = await FormTracking_1.FormTracking.findOne({ trackingId });
        if (existing) {
            res.status(409).json({
                success: false,
                message: "Tracking ID already exists"
            });
            return;
        }
        // Create new form tracking record
        const formTracking = await FormTracking_1.FormTracking.create({
            trackingId,
            formType,
            staffId,
            staffName,
            dataType,
            status: "shared",
            sharedAt: new Date(),
        });
        res.status(201).json({
            success: true,
            message: "Form share tracked successfully",
            data: formTracking,
        });
    }
    catch (error) {
        console.error("Error tracking form share:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error while tracking form share",
            error: error.message,
        });
    }
}
async function updateFormSubmission(req, res) {
    try {
        const parsed = updateFormSubmissionSchema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json({
                success: false,
                message: "Invalid payload",
                errors: parsed.error.flatten()
            });
            return;
        }
        const { trackingId, submittedData } = parsed.data;
        // Find the tracking record
        const trackingRecord = await FormTracking_1.FormTracking.findOne({ trackingId });
        if (!trackingRecord) {
            res.status(404).json({
                success: false,
                message: "Tracking record not found",
            });
            return;
        }
        // Update the record with submission data
        const submittedAt = new Date();
        const conversionTime = submittedAt.getTime() - trackingRecord.sharedAt.getTime();
        const updatedRecord = await FormTracking_1.FormTracking.findByIdAndUpdate(trackingRecord._id, {
            status: "submitted",
            submittedAt,
            submittedData,
            conversionTime,
        }, { new: true });
        res.json({
            success: true,
            message: "Form submission tracked successfully",
            data: updatedRecord,
        });
    }
    catch (error) {
        console.error("Error updating form submission:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error while updating form submission",
            error: error.message,
        });
    }
}
//# sourceMappingURL=formTracking.controller.js.map