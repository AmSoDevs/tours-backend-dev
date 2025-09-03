import { Router } from "express";
import { authenticate, requireAdmin } from "../middleware/auth";
import { createStaff, getStaff, listStaff, softDeleteStaff, updateStaff } from "../controllers/staff.controller";
import { staffLogin } from "../controllers/auth.controller";

export const staffRouter = Router();

// Public route for staff login (no authentication required)
staffRouter.post("/login", staffLogin);

// Protected routes (require admin authentication)
staffRouter.use(authenticate, requireAdmin);



staffRouter
	.route("/")
	.get(listStaff)
	.post(createStaff);


    staffRouter
	.route("/:id")
	.get(getStaff)
	.patch(updateStaff)
	.delete(softDeleteStaff);

