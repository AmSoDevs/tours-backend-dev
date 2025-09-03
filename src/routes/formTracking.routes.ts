import { Router } from "express";
import { 
  trackFormShare, 
  updateFormSubmission, 
} from "../controllers/formTracking.controller";
import { authenticate, requireAdmin, requireStaff } from "../middleware/auth";

export const formTrackingRouter = Router();

// Public route for tracking form shares (no authentication required)
formTrackingRouter.post("/share", trackFormShare);

// Public route for updating form submissions (no authentication required)
formTrackingRouter.post("/submit", updateFormSubmission);

// Admin routes (require admin authentication)
formTrackingRouter.use(authenticate, requireAdmin);

// Staff routes (require staff authentication)
