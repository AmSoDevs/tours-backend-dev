import mongoose, { Document, Model, Schema, Types } from "mongoose";

export interface StatusDocument extends Document {
	_id: Types.ObjectId;
	name: string;
	dataType: string;
	color?: string;
	isDeleted: boolean;
}

const StatusSchema = new Schema<StatusDocument>(
	{
		name: { type: String, required: true, index: true },
		dataType: { type: String, required: true },
		color: { type: String },
		isDeleted: { type: Boolean, default: false, index: true },
	},
	{ timestamps: true }
);

export const Status: Model<StatusDocument> =
	mongoose.models.Status || mongoose.model<StatusDocument>("Status", StatusSchema);


