import { Request, Response } from "express";
import { Notification } from "../models/Notification";

export const getNotifications = async (req: Request, res: Response) => {
  try {
    const { since } = req.query; // optional timestamp for polling
    const query: any = {};

    if (since) query.createdAt = { $gt: new Date(since as string) };

    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .limit(50);

    const count = notifications ? notifications?.length : 0;

    res.status(200).json({
      success: true,
      count: count,
      notifications: notifications,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Error fetching notifications",
      error: error.message,
    });
  }
};
