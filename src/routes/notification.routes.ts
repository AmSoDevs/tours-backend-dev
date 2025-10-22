import { Router } from "express";
import { getNotifications } from "../controllers/notification.controller";

export const notificationRouter = Router();

notificationRouter.get("/notifications", getNotifications);
