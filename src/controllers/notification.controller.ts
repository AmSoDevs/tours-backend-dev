import { Request, Response } from "express";
import { Notification } from "../models/Notification";
import { ReminderNotification } from "../models/ReminderNotificationModel";

export const getNotifications = async (req: Request, res: Response) => {
  try {
    const { since } = req.query;

    const query: any = {
      isIgnoredAdmin: false,
    };

    if (since) query.createdAt = { $gt: new Date(since as string) };

    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .limit(50);

    res.status(200).json({
      success: true,
      count: notifications.length,
      notifications,
    });
  } catch (error: any) {
    console.error("Error fetching notifications:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching notifications",
      error: error.message,
    });
  }
};

export const markAdminNotificationAsRead = async (
  req: Request,
  res: Response
) => {
  try {
    const { notificationId } = req.params;

    const notification = await Notification.findById(notificationId);
    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found.",
      });
    }

    notification.isRead = true;
    await notification.save();

    res.status(200).json({
      success: true,
      message: "Notification marked as read successfully.",
      notification,
    });
  } catch (error: any) {
    console.error("Error marking admin notification as read:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while marking notification as read",
      error: error.message,
    });
  }
};

export const getStaffReminders = async (req: Request, res: Response) => {
  try {
    const staffId = String(req.query.staffId || "");

    if (!staffId) {
      return res.status(400).json({
        success: false,
        message: "staffId is required in query params",
      });
    }

    // ✅ Get current time (UTC-safe) and time window
    const now = new Date();
    const fiveMinutesAhead = new Date(now.getTime() + 5 * 60 * 1000);

    // ✅ Fetch reminders due within next 5 mins or just passed within 1 min
    const reminders = await ReminderNotification.find({
      staffId,
      isIgnoredStaff: false,
      reminderDateAndTime: {
        $lte: fiveMinutesAhead,
      },
    })
      .sort({ reminderDateAndTime: 1 })
      .limit(50);

    res.status(200).json({
      success: true,
      count: reminders.length,
      reminders,
    });
  } catch (error: any) {
    console.error("Error fetching reminders:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while fetching reminders",
      error: error.message,
    });
  }
};

export const markReminderAsRead = async (req: Request, res: Response) => {
  try {
    const staffId = String(req.query.staffId || "");
    const { reminderId } = req.params;

    const reminder = await ReminderNotification.findOne({
      _id: reminderId,
      staffId,
    });

    if (!reminder) {
      return res.status(404).json({
        success: false,
        message: "Reminder not found or not assigned to this staff.",
      });
    }

    reminder.isRead = true;
    await reminder.save();

    res.status(200).json({
      success: true,
      message: "Reminder marked as read successfully.",
      reminder,
    });
  } catch (error: any) {
    console.error(" Error marking reminder as read:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while marking reminder as read",
      error: error.message,
    });
  }
};

export const markAdminNotificationAsIgnored = async (
  req: Request,
  res: Response
) => {
  try {
    const { notificationId } = req.params;

    const notification = await Notification.findById(notificationId);
    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found.",
      });
    }

    notification.isIgnoredAdmin = true;
    await notification.save();

    res.status(200).json({
      success: true,
      message: "Notification marked as ignored successfully.",
      notification,
    });
  } catch (error: any) {
    console.error("Error marking admin notification as ignored:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while marking notification as ignored",
      error: error.message,
    });
  }
};

export const markStaffReminderAsIgnored = async (
  req: Request,
  res: Response
) => {
  try {
    const staffId = String(req.query.staffId || "");

    const { reminderId } = req.params;

    const reminder = await ReminderNotification.findOne({
      _id: reminderId,
      staffId,
    });

    if (!reminder) {
      return res.status(404).json({
        success: false,
        message: "Reminder not found or not assigned to this staff.",
      });
    }

    reminder.isIgnoredStaff = true;
    await reminder.save();

    res.status(200).json({
      success: true,
      message: "Reminder marked as ignored successfully.",
      reminder,
    });
  } catch (error: any) {
    console.error("Error marking reminder as ignored:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while marking reminder as ignored",
      error: error.message,
    });
  }
};
