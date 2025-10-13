import { Request, Response } from "express";
import { z } from "zod";
import mongoose from "mongoose";
import { FormTracking } from "../models/FormTracking";
import { Status } from "../models/Status";
import { Data } from "../models/Data"; // 👈 Added
import { generateUniqueTrackingId } from "../utils/helper";

const trackFormShareSchema = z.object({
  formType: z.string().min(1),
  staffId: z.string().min(1),
  dataId: z.string().optional(),
  isReference: z.boolean().optional(),
  allowMultiple: z.boolean().optional(),
});

export async function trackFormShare(req: Request, res: Response): Promise<void> {
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
    let existing = await FormTracking.findOne({ dataId, staffId, formType, isReference, allowMultiple });
    if (!existing) {
      const trackingId = await generateUniqueTrackingId();
      existing = await FormTracking.create({
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
    if (dataId && mongoose.Types.ObjectId.isValid(dataId)) {
      const reminderDateAndTime = new Date().toISOString();

      console.log("📤 Updating Data record:", dataId);

      const updated = await Data.findByIdAndUpdate(
        dataId,
        {
          $set: {
            status: "Success",
            reminderDateAndTime,
          },
        },
        { new: true, strict: false }
      );

      if (updated) {
        console.log(`✅ Data record ${dataId} updated to "Success"`);
      } else {
        console.log("⚠️ No matching Data record found to update");
      }
    }

    // 3️⃣ (Optional) Also sync general Status by formType
    await Status.updateOne(
      { dataType: formType, isDeleted: false },
      { $set: { name: "Success" } },
      { upsert: true, strict: false }
    );

    res.status(201).json({
      success: true,
      message: "Form share tracked and Data record updated to Success",
      data: existing.trackingId,
    });
  } catch (error: any) {
    console.error("❌ Error tracking form share:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while tracking form share",
      error: error.message,
    });
  }
}
