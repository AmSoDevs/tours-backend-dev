import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    staffId: { type: mongoose.Schema.Types.ObjectId, ref: "Staff", required: true },
    profileId: { type: String },
    name: { type: String },
    message: { type: String },
    type: { type: String, default: "payment_update" },
    isRead: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const Notification = mongoose.model("Notification", notificationSchema);
