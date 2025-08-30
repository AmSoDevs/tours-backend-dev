import mongoose, { Document, Model, Schema, Types } from "mongoose";
import bcrypt from "bcrypt";

export interface AdminDocument extends Document {
	_id: Types.ObjectId;
	name: string;
	email: string;
	passwordHash: string;
	comparePassword(plain: string): Promise<boolean>;
}

const AdminSchema = new Schema<AdminDocument>(
	{
		name: { type: String, required: true },
		email: { type: String, required: true, unique: true, index: true },
		passwordHash: { type: String, required: true },
	},
	{ timestamps: true }
);

AdminSchema.methods.comparePassword = async function (this: AdminDocument, plain: string): Promise<boolean> {
	return bcrypt.compare(plain, this.passwordHash);
};

export const Admin: Model<AdminDocument> = mongoose.models.Admin || mongoose.model<AdminDocument>("Admin", AdminSchema);
