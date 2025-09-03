import { Router } from "express";
import { createStatus, getStatus, listStatuses, softDeleteStatus, updateStatus } from "../controllers/status.controller";
import { authenticate, requireAdmin, requireStaff } from "../middleware/auth";

export const statusRouter = Router();

// Staff route to read status data (for filtering purposes)
statusRouter.get("/staff/:id", authenticate, requireStaff, listStatuses);

// Admin routes (require admin authentication)
statusRouter.use(authenticate, requireAdmin);
statusRouter
	.route("/")
	.get(listStatuses)
	.post(createStatus);

statusRouter
	.route("/:id")
	.get(getStatus)
	.patch(updateStatus)
	.delete(softDeleteStatus);


