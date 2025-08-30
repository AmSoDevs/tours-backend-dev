import bcrypt from "bcrypt";
import { Admin } from "../models/Admin";
import { config } from "../config";

export async function ensureAdminSeeded(): Promise<void> {
	const existing = await Admin.findOne({ email: config.admin.email });
	if (existing) return;
	const passwordHash = await bcrypt.hash(config.admin.password, 10);
	await Admin.create({ name: config.admin.name, email: config.admin.email, passwordHash });
}
