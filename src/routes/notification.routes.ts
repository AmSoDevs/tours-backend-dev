import { Router } from "express";
import {
  getNotifications,
  getStaffReminders,
  markAdminNotificationAsRead,
  markReminderAsRead,
} from "../controllers/notification.controller";

export const notificationRouter = Router();

notificationRouter.get("/", getNotifications);
notificationRouter.patch("/read/:notificationId", markAdminNotificationAsRead);
notificationRouter.get("/staff/:id/reminders", getStaffReminders);
notificationRouter.patch(
  "/staff/:id/reminders/:reminderId/read",
  markReminderAsRead
);
