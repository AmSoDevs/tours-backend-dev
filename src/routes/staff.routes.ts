import { Router } from "express";
import { authenticate, requireAdmin } from "../middleware/auth";
import { createStaff, getStaff, listStaff,  softDeleteStaff, updateStaff } from "../controllers/staff.controller";

export const staffRouter = Router();

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

