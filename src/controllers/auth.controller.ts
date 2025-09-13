import { Request, Response } from "express";
import jwt, { Secret, SignOptions } from "jsonwebtoken";
import { z } from "zod";
import { config } from "../config";
import { Admin } from "../models/Admin";
import { Staff } from "../models/Staff";

const loginSchema = z.object({
	email: z.string().email(),
	password: z.string().min(1),
});

const staffLoginSchema = z.object({
	emailOrUsername: z.string().min(1),
	password: z.string().min(1),
});

export async function adminLogin(req: Request, res: Response): Promise<void> {
	const parsed = loginSchema.safeParse(req.body);
	if (!parsed.success) {
		res.status(400).json({ success: false, message: "Invalid payload", errors: parsed.error.flatten() });
		return;
	}

	const { email, password } = parsed.data;

	const admin = await Admin.findOne({ email });
	if (!admin) {
		res.status(401).json({ success: false, message: "Invalid credentials" });
		return;
	}

	const isValid = await admin.comparePassword(password);
	if (!isValid) {
		res.status(401).json({ success: false, message: "Invalid credentials" });
		return;
	}

	const payload = {
		sub: String(admin._id),
		role: "admin" as const,
		name: admin.name,
		email: admin.email,
	};
	const secret: Secret = config.auth.jwtSecret as Secret;
	const expiresIn = config.auth.jwtExpiresIn as unknown as SignOptions["expiresIn"];
	const options: SignOptions = { expiresIn };

	const token = jwt.sign(payload, secret, options);

	res.status(200).json({
		success: true,
		user: { name: admin.name, email: admin.email, role: "admin" },
		token,
	});
}

export async function staffLogin(req: Request, res: Response): Promise<void> {
	const parsed = staffLoginSchema.safeParse(req.body);
	if (!parsed.success) {
		res.status(400).json({ success: false, message: "Invalid payload", errors: parsed.error.flatten() });
		return;
	}

	const { emailOrUsername, password } = parsed.data;

	// Search for staff by either email or username
	const staff = await Staff.findOne({
		$or: [
			{ email: emailOrUsername },
			{ username: emailOrUsername }
		],
		isDeleted: false,
		isActive: true
	});
	
	if (!staff) {
		res.status(401).json({ success: false, message: "Invalid credentials" });
		return;
	}

	const isValid = staff.password === password;
	if (!isValid) {
		res.status(401).json({ success: false, message: "Invalid credentials" });
		return;
	}

	const payload = {
		sub: String(staff._id),
		role: "staff" as const,
		name: staff.name,
		email: staff.email,
		username: staff.username,
		staffId: staff.staffId,
	};
	const secret: Secret = config.auth.jwtSecret as Secret;
	const expiresIn = config.auth.jwtExpiresIn as unknown as SignOptions["expiresIn"];
	const options: SignOptions = { expiresIn };

	const token = jwt.sign(payload, secret, options);

	res.status(200).json({
		success: true,
		user: { 
			id: String(staff._id),
			name: staff.name, 
			email: staff.email,
			username: staff.username,
			role: "staff",
			staffId: staff.staffId 
		},
		token,
	});
}
