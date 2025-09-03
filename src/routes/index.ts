import { Router } from "express";
import { authRouter } from "./auth.routes";
import { staffRouter } from "./staff.routes";
import { statusRouter } from "./status.routes";
import { dataRouter } from "./data.routes";
import { publicRouter } from "./public.routes";
import { formTrackingRouter } from "./formTracking.routes";

export const apiRouter = Router();

apiRouter.get("/", (_req, res) => {
	res.json({ message: "CRM API v1" });
});

apiRouter.use("/auth", authRouter);
apiRouter.use("/staff", staffRouter);
apiRouter.use("/status", statusRouter);
apiRouter.use("/data", dataRouter);
apiRouter.use("/public", publicRouter);
apiRouter.use("/form-tracking", formTrackingRouter);
