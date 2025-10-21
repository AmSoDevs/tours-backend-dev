import { Request, Response } from "express";
import { z } from "zod";
import mongoose from "mongoose";
import { FormTracking } from "../models/FormTracking";
import { Status } from "../models/Status";
import { Data } from "../models/Data"; // 👈 Added
import {
  generatePrefixedProfileId,
  generateUniqueTrackingId,
} from "../utils/helper";

const trackFormShareSchema = z.object({
  formType: z.string().min(1),
  staffId: z.string().min(1),
  dataId: z.string().optional(),
  isReference: z.boolean().optional(),
  allowMultiple: z.boolean().optional(),
});

export async function trackFormShare(
  req: Request,
  res: Response
): Promise<void> {
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

    const { formType, staffId, dataId, isReference, allowMultiple } =
      parsed.data;

    // 1️⃣ Create or reuse tracking record
    let existing = await FormTracking.findOne({
      dataId,
      staffId,
      formType,
      isReference,
      allowMultiple,
    });
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

const PREFIX_MAP: Record<string, string> = {
  register: "R",
  job: "J",
  matrimony: "M",
  visa: "V",
  house: "H",
  pg: "P",
};

export async function addMoreRegistration(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { formType, dataId, staffId, referenceId } = req.body;

    if (!formType || !dataId || !staffId) {
      res.status(400).json({
        success: false,
        message: "formType, dataId and staffId are required fields.",
      });
      return;
    }

    if (!mongoose.Types.ObjectId.isValid(dataId)) {
      res.status(400).json({
        success: false,
        message: "Invalid dataId format.",
      });
      return;
    }

    // 1️⃣ Fetch source record
    const existingData = await Data.findById(dataId);
    if (!existingData) {
      res.status(404).json({
        success: false,
        message: "Source record not found.",
      });
      return;
    }

    // 2️⃣ Prevent duplicate mobile for same formType
    const existingSameForm = await Data.findOne({
      data: formType,
      mobile: existingData.mobile,
      isDeleted: false,
    });

    if (existingSameForm) {
      res.status(400).json({
        success: false,
        message: `A record already exists with formType "${formType}" and the same mobile number.`,
      });
      return;
    }

    // 3️⃣ Safe clone: omit unwanted or form-specific fields
    const {
      _id,
      __v,
      status,
      profileId,
      regPayment,
      serPayment,
      regReceived,
      serReceived,
      regBalance,
      serBalance,
      regPaymentUpdatedAt,
      serPaymentUpdatedAt,
      regReceivedUpdatedAt,
      serReceivedUpdatedAt,
      reminderDateAndTime,
      callClickTime,
      whatsappClickTime,
      refferenceCallClickTime,
      refferenceWhatsappClickTime,
      ...clonedData
    } = existingData.toObject();

    // 4️⃣ Generate new profile ID with prefix
    const prefix =
      PREFIX_MAP[formType.toLowerCase()] || formType.slice(0, 3).toUpperCase();
    const newProfileId = await generatePrefixedProfileId(prefix);

    // 5️⃣ Create cloned record
    const newData = new Data({
      ...clonedData,
      _id: new mongoose.Types.ObjectId(),
      data: formType, // e.g., job, matrimony, etc.
      slNo: existingData.slNo, // ✅ same slNo links family
      profileId: newProfileId, // ✅ unique per form
      assignedStaff: staffId,
      refferenceNumber: referenceId || existingData.mobile,
      isDeleted: false,
      status: "Pending",
      createdAt: new Date(),
      updatedAt: new Date(),
      isDuplicateAllowed: false,
    });

    await newData.save();

    // 6️⃣ Create new FormTracking entry
    const trackingId = await generateUniqueTrackingId();
    const formTrack = await FormTracking.create({
      trackingId,
      formType,
      staffId,
      dataId: newData._id,
      isReference: false,
      allowMultiple: false,
      status: "shared",
      sharedAt: new Date(),
      currentStep: 0,
    });

    res.status(201).json({
      success: true,
      message: `New ${formType} record created successfully from ${existingData.data}.`,
      data: {
        trackingId: formTrack.trackingId,
        newRecord: newData,
      },
    });
  } catch (error: any) {
    console.error("❌ Error in addMoreRegistration:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while adding new registration",
      error: error.message,
    });
  }
}
