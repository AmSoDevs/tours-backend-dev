import mongoose, { Document, Model, Schema, Types } from "mongoose";

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
	password: string;
	isDeleted: boolean;
	isActive: boolean;
	comparePassword(plain: string): Promise<boolean>;
	files: Types.ObjectId[];
	profilePhoto?: string;
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
		password: { type: String, required: true },
		isActive: { type: Boolean, default: true},
		isDeleted: { type: Boolean, default: false, index: true },
		files: [{ type: Schema.Types.ObjectId, ref: "Files" }],
		profilePhoto: { type: String, required: false },
	},
	{ timestamps: true }
);

// Note: staffId will be generated in the controller using generateUniqueStaffId helper
// This ensures sequential numbering per work type (H1, H2, H3... for home, O1, O2, O3... for office)

StaffSchema.methods.comparePassword = async function (this: StaffDocument, plain: string): Promise<boolean> {
	// Direct string comparison since passwords are stored as plain text
	return this.password === plain;
};

export const Staff: Model<StaffDocument> = mongoose.models.Staff || mongoose.model<StaffDocument>("Staff", StaffSchema);
