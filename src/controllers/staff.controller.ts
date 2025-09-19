import { Request, Response } from "express";
import { z } from "zod";
import { Staff } from "../models/Staff";
import { generateUniqueStaffId, checkExistingStaffIds, resetStaffAssignmentIfNeeded } from "../utils/helper";

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
	isActive: z.boolean().default(true),
});

const updateSchema = z.object({
	name: z.string().min(1).optional(),
	email: z.string().email().optional(),
	isActive: z.boolean().optional(),
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
		password: staff.password,
		gender: staff.gender,
		dateOfBirth: staff.dateOfBirth,
		qualification: staff.qualification,
		salary: staff.salary,
		workType: staff.workType,
		whatsappNumber: staff.whatsappNumber,
		gpayNumber: staff.gpayNumber,
		role: staff.role,
		createdAt: staff.createdAt,
		isActive: staff.isActive,
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
	
	const staffId = await generateUniqueStaffId(data.workType);
	
	const staff = await Staff.create({ ...data, staffId, password, isActive: data.isActive ?? true });
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
		createdAt: 1,
		isActive: 1,
		password: 1,
	}).sort({ createdAt: -1 });
	
	await checkExistingStaffIds();
	
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
		isActive: 1,
		password: 1,
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
	
	const d = parsed.data as any;
	
	if (d.email !== undefined || d.username !== undefined) {
		const conflictQuery: any = { _id: { $ne: id } }; 
		const orConditions: any[] = [];
		
		if (d.email !== undefined) {
			orConditions.push({ email: d.email });
		}
		if (d.username !== undefined) {
			orConditions.push({ username: d.username });
		}
		
		if (orConditions.length > 0) {
			conflictQuery.$or = orConditions;
			const conflict = await Staff.findOne(conflictQuery);
			if (conflict) {
				res.status(409).json({ success: false, message: "Email or username already in use" });
				return;
			}
		}
	}
	
	const updates: Record<string, unknown> = {};
	if (d.name !== undefined) updates.name = d.name;
	if (d.email !== undefined) updates.email = d.email;
	if (d.username !== undefined) updates.username = d.username;
	if (d.gender !== undefined) updates.gender = d.gender;
	if (d.dateOfBirth !== undefined) updates.dateOfBirth = d.dateOfBirth;
	if (d.qualification !== undefined) updates.qualification = d.qualification;
	if (d.salary !== undefined) updates.salary = d.salary;
	if (d.workType !== undefined) updates.workType = d.workType;
	if (d.whatsappNumber !== undefined) updates.whatsappNumber = d.whatsappNumber;
	if (d.gpayNumber !== undefined) updates.gpayNumber = d.gpayNumber;
	if (d.password !== undefined) updates.password = d.password;
	if (d.isActive !== undefined) updates.isActive = d.isActive;
	
	const staff = await Staff.findByIdAndUpdate({_id:id}, updates, { new: true, projection: {
		name: 1,isActive: 1, email: 1, username: 1, password: 1, gender: 1, dateOfBirth: 1, qualification: 1, salary: 1, workType: 1, whatsappNumber: 1, gpayNumber: 1, role: 1, staffId: 1,createdAt:1
	} });
	if (!staff) {
		res.status(404).json({ success: false, message: "Staff not found" });
		return;
	}
	
	if (d.isActive !== undefined) {
		await resetStaffAssignmentIfNeeded();
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
	
	
	await resetStaffAssignmentIfNeeded();
	
	res.status(200).json({ success: true });
}

