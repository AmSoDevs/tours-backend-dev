import { Router } from "express";
import {
  getNotifications,
  getStaffReminders,
  markAdminNotificationAsRead,
  markReminderAsRead,
  markAdminNotificationAsIgnored,
  markStaffReminderAsIgnored,
} from "../controllers/notification.controller";

export const notificationRouter = Router();
//admin

notificationRouter.get("/notifications", getNotifications);
notificationRouter.patch(
  "/notifications/read/:notificationId",
  markAdminNotificationAsRead
);
notificationRouter.patch(
  "/notifications/ignore/:notificationId",
  markAdminNotificationAsIgnored
);

//staff
notificationRouter.get("/staff/reminders", getStaffReminders);
notificationRouter.patch(
  "/staff/reminders/read/:reminderId",
  markReminderAsRead
);
notificationRouter.patch(
  "/staff/reminders/ignore/:reminderId",
  markStaffReminderAsIgnored
);
