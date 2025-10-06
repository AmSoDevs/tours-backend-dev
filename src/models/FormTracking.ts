import mongoose, { Document, Schema } from "mongoose";

export interface IFormTracking extends Document {
  trackingId: string;
  formType: string;
  staffId?: mongoose.Types.ObjectId;
  dataId?: mongoose.Types.ObjectId;
  sharedAt: Date;
  submittedAt?: Date;
  status: "shared" | "in_progress" | "submitted" | "expired" | "abandoned";
  submittedData?: any;
  isActive: boolean;
  currentStep: number;
  createdAt: Date;
  updatedAt: Date;
  isReference?: boolean;
  allowMultiple?: boolean;
}


const FormTrackingSchema = new Schema<IFormTracking>(
  {
    trackingId: {
      type: String,
      required: true,
      unique: true,
    },
    formType: {
      type: String,
      enum: ["bulk","lead", "register", "house", "matrimony", "job", "visa"],
    },
    staffId: {
      type: Schema.Types.ObjectId,
      ref: "Staff",
    },
    dataId: {
      type: Schema.Types.ObjectId,
      ref: "Data",
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
      enum: ["shared", "in_progress", "submitted", "expired", "abandoned"],
      default: "shared",
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    currentStep: {
      type: Number,
      default: 0,
    },
    isReference: {
      type: Boolean,
      default: false,
      required: false,
    },
    allowMultiple: {
      type: Boolean,
      default: false,
      required: false,
    },
  },
  {
    timestamps: true,
  }
);


export const FormTracking = mongoose.model<IFormTracking>(
  "FormTracking",
  FormTrackingSchema
);
