import mongoose, { Document, Model, Schema, Types } from "mongoose";

export interface FileDocument extends Document {
	_id: Types.ObjectId;
	url: string;
	createdBy?: Types.ObjectId;
    title?: string;
    context: "staff" | "data" | "other";
    staffId?: Types.ObjectId;
    dataId?: Types.ObjectId;
    
}

const FileSchema = new Schema<FileDocument>(
	{
        url: { type: String, required: true },
        createdBy: { type: Schema.Types.ObjectId, ref: "User", required: false },
        title: { type: String },
        context: { type: String, enum: ["staff", "data", "other"], required: true, default: "other" },
        staffId: { type: Schema.Types.ObjectId, ref: "Staff" },
        dataId: { type: Schema.Types.ObjectId, ref: "Data" },
	},
	{ timestamps: true }
);

export const Files: Model<FileDocument> =
	mongoose.models.Files || mongoose.model<FileDocument>("Files", FileSchema);


