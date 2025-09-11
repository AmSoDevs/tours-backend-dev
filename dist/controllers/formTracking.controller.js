"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.trackFormShare = trackFormShare;
const zod_1 = require("zod");
const FormTracking_1 = require("../models/FormTracking");
const helper_1 = require("../utils/helper");
const trackFormShareSchema = zod_1.z.object({
    formType: zod_1.z.string().min(1),
    staffId: zod_1.z.string().min(1),
    dataId: zod_1.z.string().optional(),
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
        const { formType, staffId, dataId } = parsed.data;
        // Check if tracking ID already exists
        const existing = await FormTracking_1.FormTracking.findOne({ dataId, staffId, formType });
        if (existing) {
            res.status(201).json({
                success: true,
                message: "Form share tracked successfully",
                data: existing?.trackingId,
            });
            return;
        }
        const trackingId = await (0, helper_1.generateUniqueTrackingId)();
        const formTracking = await FormTracking_1.FormTracking.create({
            trackingId,
            formType,
            staffId,
            dataId,
            status: "shared",
            sharedAt: new Date(),
            currentStep: 0,
        });
        res.status(201).json({
            success: true,
            message: "Form share tracked successfully",
            data: formTracking?.trackingId,
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
//# sourceMappingURL=formTracking.controller.js.map