import { Request, Response } from "express";
import { z } from "zod";
import bcrypt from "bcrypt";
import { Staff } from "../models/Staff";

const createSchema = z.object({
	name: z.string().min(1),
	email: z.string().email(),
	username: z.string().min(3),
	gender: z.enum(["male", "female", "other"]),
	dateOfBirth: z.string().transform((v) => new Date(v)),
	qualification: z.string().min(1),
	salary: z.number().nonnegative(),
	workType: z.enum(["home", "office"]),
	whatsappNumber: z.string().min(6),
	gpayNumber: z.string().min(6),
	password: z.string().min(6),
});

const updateSchema = z.object({
	name: z.string().min(1).optional(),
	username: z.string().min(3).optional(),
	gender: z.enum(["male", "female", "other"]).optional(),
	dateOfBirth: z.string().transform((v) => new Date(v)).optional(),
	qualification: z.string().min(1).optional(),
	salary: z.number().nonnegative().optional(),
	workType: z.enum(["home", "office"]).optional(),
	whatsappNumber: z.string().min(6).optional(),
	gpayNumber: z.string().min(6).optional(),
	password: z.string().min(6).optional(),
});

function presentStaff(staff: any) {
	return {
		id: String(staff._id),
		staffId: staff.staffId,
		name: staff.name,
		email: staff.email,
		username: staff.username,
		gender: staff.gender,
		dateOfBirth: staff.dateOfBirth,
		qualification: staff.qualification,
		salary: staff.salary,
		workType: staff.workType,
		whatsappNumber: staff.whatsappNumber,
		gpayNumber: staff.gpayNumber,
		role: staff.role,
	};
}

export async function createStaff(req: Request, res: Response): Promise<void> {
	const parsed = createSchema.safeParse(req.body);
	if (!parsed.success) {
		res.status(400).json({ success: false, message: "Invalid payload", errors: parsed.error.flatten() });
		return;
	}
	const { password, ...data } = parsed.data as any;
	const conflict = await Staff.findOne({ $or: [{ email: data.email }, { username: data.username }] });
	if (conflict) {
		res.status(409).json({ success: false, message: "Email or username already in use" });
		return;
	}
	const passwordHash = await bcrypt.hash(password, 10);
	const staff = await Staff.create({ ...data, passwordHash });
	res.status(201).json({ success: true, staff: presentStaff(staff) });
}

export async function listStaff(_req: Request, res: Response): Promise<void> {
	const staff = await Staff.find({ isDeleted: false }, {
		name: 1,
		email: 1,
		username: 1,
		gender: 1,
		dateOfBirth: 1,
		qualification: 1,
		salary: 1,
		workType: 1,
		whatsappNumber: 1,
		gpayNumber: 1,
		role: 1,
		staffId: 1,
	}).sort({ createdAt: -1 });
	res.json({ success: true, staff: staff.map(presentStaff) });
}

export async function getStaff(req: Request, res: Response): Promise<void> {
	const { id } = req.params;
	const staff = await Staff.findById(id, {
		name: 1,
		email: 1,
		username: 1,
		gender: 1,
		dateOfBirth: 1,
		qualification: 1,
		salary: 1,
		workType: 1,
		whatsappNumber: 1,
		gpayNumber: 1,
		role: 1,
		staffId: 1,
	});
	if (!staff) {
		res.status(404).json({ success: false, message: "Staff not found" });
		return;
	}
	res.json({ success: true, staff: presentStaff(staff) });
}

export async function updateStaff(req: Request, res: Response): Promise<void> {
	const { id } = req.params;
	const parsed = updateSchema.safeParse(req.body);
	if (!parsed.success) {
		res.status(400).json({ success: false, message: "Invalid payload", errors: parsed.error.flatten() });
		return;
	}
	const updates: Record<string, unknown> = {};
	const d = parsed.data as any;
	if (d.name) updates.name = d.name;
	if (d.username) updates.username = d.username;
	if (d.gender) updates.gender = d.gender;
	if (d.dateOfBirth) updates.dateOfBirth = d.dateOfBirth;
	if (d.qualification) updates.qualification = d.qualification;
	if (d.salary !== undefined) updates.salary = d.salary;
	if (d.workType) updates.workType = d.workType;
	if (d.whatsappNumber) updates.whatsappNumber = d.whatsappNumber;
	if (d.gpayNumber) updates.gpayNumber = d.gpayNumber;
	if (d.password) updates.passwordHash = await bcrypt.hash(d.password, 10);
	const staff = await Staff.findByIdAndUpdate(id, updates, { new: true, projection: {
		name: 1, email: 1, username: 1, gender: 1, dateOfBirth: 1, qualification: 1, salary: 1, workType: 1, whatsappNumber: 1, gpayNumber: 1, role: 1, staffId: 1,
	} });
	if (!staff) {
		res.status(404).json({ success: false, message: "Staff not found" });
		return;
	}
	res.json({ success: true, staff: presentStaff(staff) });
}

export async function softDeleteStaff(req: Request, res: Response): Promise<void> {
	const { id } = req.params;
	const staff = await Staff.findByIdAndUpdate(id, { isDeleted: true }, { new: true });
	if (!staff) {
		res.status(404).json({ success: false, message: "Staff not found" });
		return;
	}
	res.status(200).json({ success: true });
}

