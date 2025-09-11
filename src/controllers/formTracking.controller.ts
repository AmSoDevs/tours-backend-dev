import { Request, Response } from "express";
import { z } from "zod";
import { FormTracking } from "../models/FormTracking";
import { generateUniqueTrackingId } from "../utils/helper";

const trackFormShareSchema = z.object({
  formType: z.string().min(1),
  staffId: z.string().min(1),
  dataId: z.string().min(1),
 
});



export async function trackFormShare(req: Request, res: Response): Promise<void> {
  try {
    const parsed = trackFormShareSchema.safeParse(req.body);
    console.log(req.body,"req.body");
    
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
    const existing = await FormTracking.findOne({ dataId, staffId,formType });
    if (existing) {
      console.log("existing",existing);
      
       res.status(201).json({
        success: true,
        message: "Form share tracked successfully",
        data: existing?.trackingId,
      });
      return
    }
const trackingId= await generateUniqueTrackingId();
    const formTracking = await FormTracking.create({
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
  } catch (error: any) {
    console.error("Error tracking form share:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while tracking form share",
      error: error.message,
    });
  }
}






