import mongoose, { Document, Model, Schema, Types } from "mongoose";
import bcrypt from "bcrypt";

export type WorkType = "home" | "office";
export type Gender = "male" | "female" | "other";

export interface StaffDocument extends Document {
	_id: Types.ObjectId;
	name: string;
	email: string;
	username: string;
	gender: Gender;
	dateOfBirth: Date;
	qualification: string;
	salary: number;
	workType: WorkType;
	whatsappNumber: string;
	gpayNumber: string;
	staffId: string;
	role: "staff";
	passwordHash: string;
	isDeleted: boolean;
	comparePassword(plain: string): Promise<boolean>;
}

const StaffSchema = new Schema<StaffDocument>(
	{
		name: { type: String, required: true },
		email: { type: String, required: true, unique: true, index: true },
		username: { type: String, required: true, unique: true, index: true },
		gender: { type: String, enum: ["male", "female", "other"], required: true },
		dateOfBirth: { type: Date, required: true },
		qualification: { type: String, required: true },
		salary: { type: Number, required: true, min: 0 },
		workType: { type: String, enum: ["home", "office"], required: true },
		whatsappNumber: { type: String, required: true },
		gpayNumber: { type: String, required: true },
		staffId: { type: String, required: true, unique: true, index: true },
		role: { type: String, enum: ["staff"], default: "staff" },
		passwordHash: { type: String, required: true },
		isDeleted: { type: Boolean, default: false, index: true },
	},
	{ timestamps: true }
);

// Generate staffId encoding work type: H-YYYYMMDD-XXXX or O-YYYYMMDD-XXXX
StaffSchema.pre("validate", function (next) {
	if (!this.staffId && this.workType) {
		const prefix = this.workType === "home" ? "H" : "O";
		const now = new Date();
		const y = now.getFullYear().toString();
		const m = String(now.getMonth() + 1).padStart(2, "0");
		const d = String(now.getDate()).padStart(2, "0");
		const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
		this.staffId = `${prefix}-${y}${m}${d}-${rand}`;
	}
	next();
});

StaffSchema.methods.comparePassword = async function (this: StaffDocument, plain: string): Promise<boolean> {
	return bcrypt.compare(plain, this.passwordHash);
};

export const Staff: Model<StaffDocument> = mongoose.models.Staff || mongoose.model<StaffDocument>("Staff", StaffSchema);
