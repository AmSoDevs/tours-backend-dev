import mongoose, { Document, Schema } from "mongoose";

export interface IFormTracking extends Document {
  trackingId: string;
  formType: string;
  staffId: mongoose.Types.ObjectId;
  staffName: string;
  sharedAt: Date;
  submittedAt?: Date;
  status: "shared" | "submitted" | "expired";
  dataType: string;
  submittedData?: any;
  conversionTime?: number; // Time between share and submission in milliseconds
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const FormTrackingSchema = new Schema<IFormTracking>(
  {
    trackingId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    formType: {
      type: String,
      required: true,
      enum: ["bulk", "register", "house", "matrimony", "job"],
    },
    staffId: {
      type: Schema.Types.ObjectId,
      ref: "Staff",
      required: true,
    },
    staffName: {
      type: String,
      required: true,
    },
    sharedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    submittedAt: {
      type: Date,
    },
    status: {
      type: String,
      required: true,
      enum: ["shared", "submitted", "expired"],
      default: "shared",
    },
    dataType: {
      type: String,
      required: true,
    },
    submittedData: {
      type: Schema.Types.Mixed,
    },
    conversionTime: {
      type: Number, // Time in milliseconds
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Index for efficient queries
FormTrackingSchema.index({ staffId: 1, status: 1 });
FormTrackingSchema.index({ formType: 1, status: 1 });
FormTrackingSchema.index({ sharedAt: 1 });
FormTrackingSchema.index({ trackingId: 1 });

export const FormTracking = mongoose.model<IFormTracking>("FormTracking", FormTrackingSchema);
