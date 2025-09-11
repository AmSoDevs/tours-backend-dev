import { Router } from "express";
import { 
  trackFormShare, 
} from "../controllers/formTracking.controller";
import { authenticate, requireAdmin, requireStaff } from "../middleware/auth";

export const registrationRouter = Router();








registrationRouter.use(authenticate, requireAdmin);


registrationRouter.post("/share", trackFormShare);


// Admin routes (require admin authentication)
registrationRouter.use(requireAdmin);
