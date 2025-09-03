import { Request, Response } from "express";
import { z } from "zod";
import { FormTracking } from "../models/FormTracking";

const trackFormShareSchema = z.object({
  trackingId: z.string().min(1),
  formType: z.string().min(1),
  staffId: z.string().min(1),
  staffName: z.string().min(1),
  dataType: z.string().min(1),
});

const updateFormSubmissionSchema = z.object({
  trackingId: z.string().min(1),
  submittedData: z.any(),
});

export async function trackFormShare(req: Request, res: Response): Promise<void> {
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
    const existing = await FormTracking.findOne({ trackingId });
    if (existing) {
      res.status(409).json({ 
        success: false, 
        message: "Tracking ID already exists" 
      });
      return;
    }

    // Create new form tracking record
    const formTracking = await FormTracking.create({
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
  } catch (error: any) {
    console.error("Error tracking form share:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while tracking form share",
      error: error.message,
    });
  }
}

export async function updateFormSubmission(req: Request, res: Response): Promise<void> {
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
    const trackingRecord = await FormTracking.findOne({ trackingId });
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

    const updatedRecord = await FormTracking.findByIdAndUpdate(
      trackingRecord._id,
      {
        status: "submitted",
        submittedAt,
        submittedData,
        conversionTime,
      },
      { new: true }
    );

    res.json({
      success: true,
      message: "Form submission tracked successfully",
      data: updatedRecord,
    });
  } catch (error: any) {
    console.error("Error updating form submission:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while updating form submission",
      error: error.message,
    });
  }
}


