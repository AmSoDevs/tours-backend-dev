import mongoose, { Document, Model, Schema } from "mongoose";

export interface StaffAssignmentDocument extends Document {
  _id: string;
  lastAssignedStaffIndex: number;
  totalAssignedRecords: number;
  updatedAt: Date;
  createdAt: Date;
}

const StaffAssignmentSchema = new Schema<StaffAssignmentDocument>(
  {
    lastAssignedStaffIndex: { type: Number, default: -1 },
    totalAssignedRecords: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// Ensure only one document exists
StaffAssignmentSchema.index({}, { unique: true });

export const StaffAssignment: Model<StaffAssignmentDocument> =
  mongoose.models.StaffAssignment || mongoose.model<StaffAssignmentDocument>("StaffAssignment", StaffAssignmentSchema);
