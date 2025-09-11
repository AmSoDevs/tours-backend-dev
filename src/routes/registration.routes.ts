import { Router } from "express";
import { 
  trackFormShare, 
} from "../controllers/formTracking.controller";
import { authenticate, requireAdmin, requireStaff } from "../middleware/auth";

export const registrationRouter = Router();







// Staff routes (require staff authentication)
// registrationRouter.use(authenticate, requireStaff);
registrationRouter.use(authenticate, requireAdmin);


registrationRouter.post("/share", trackFormShare);


// Admin routes (require admin authentication)
registrationRouter.use(requireAdmin);
