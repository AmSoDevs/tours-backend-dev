import mongoose, { Schema, Document, Model, Types } from "mongoose";

export interface ReminderNotificationDocument extends Document {
  staffId: Types.ObjectId;
  profileId: string;
  name: string;
  phone?: string;
  remarks?: string;
  message: string;
  reminderDateAndTime: Date;
  isRead: boolean;
  isIgnoredStaff: boolean;
  notified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ReminderNotificationSchema = new Schema<ReminderNotificationDocument>(
  {
    staffId: { type: Schema.Types.ObjectId, ref: "Staff", required: true },
    profileId: { type: String, required: true },
    name: { type: String, required: true },
    phone: { type: String },
    remarks: { type: String },
    message: { type: String, required: true },
    reminderDateAndTime: { type: Date, required: true },
    isRead: { type: Boolean, default: false },
    isIgnoredStaff: { type: Boolean, default: false }, 
    notified: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const ReminderNotification: Model<ReminderNotificationDocument> =
  mongoose.models.ReminderNotification ||
  mongoose.model<ReminderNotificationDocument>(
    "ReminderNotification",
    ReminderNotificationSchema
  );
