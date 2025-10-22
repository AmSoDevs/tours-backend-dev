import { Router } from "express";
import { 
  addMoreRegistration,
  trackFormShare, 
} from "../controllers/formTracking.controller";
import { authenticate, requireAdmin } from "../middleware/auth";

export const registrationRouter = Router();








registrationRouter.use(authenticate);


registrationRouter.post("/share", trackFormShare);
registrationRouter.post("/addmore", addMoreRegistration);


// Admin routes (require admin authentication)
registrationRouter.use(requireAdmin);
