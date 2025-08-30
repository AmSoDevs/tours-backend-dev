import { Router } from "express";
import { createStatus, getStatus, listStatuses, softDeleteStatus, updateStatus } from "../controllers/status.controller";
import { authenticate, requireAdmin } from "../middleware/auth";

export const statusRouter = Router();
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


