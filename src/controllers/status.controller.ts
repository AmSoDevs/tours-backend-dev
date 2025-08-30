import { Request, Response } from "express";
import { z } from "zod";
import { Status } from "../models/Status";
import mongoose from "mongoose";

const createSchema = z.object({
	name: z.string().min(1),
	dataType: z.string().min(1),
	color: z.string().min(1),
});

const updateSchema = z.object({
	name: z.string().min(1).optional(),
	dataType: z.string().min(1).optional(),
	color: z.string().min(1).optional(),
	isDeleted: z.boolean().optional(),
});

function presentStatus(s: any) {
	return {
		id: String(s._id),
		name: s.name,
		dataType: s.dataType,
		color: s.color,
	};
}

export async function createStatus(req: Request, res: Response): Promise<void> {
	const parsed = createSchema.safeParse(req.body);
	if (!parsed.success) {
		res.status(400).json({ success: false, message: "Invalid payload", errors: parsed.error.flatten() });
		return;
	}
	const payload = parsed.data as any;
	// Prevent duplicates by name (case-insensitive) among non-deleted
	const existing = await Status.findOne({ name: { $regex: `^${payload.name}$`, $options: "i" }, isDeleted: false });
	if (existing) {
		res.status(409).json({ success: false, message: "Status name already exists" });
		return;
	}
	const status = await Status.create({ name: payload.name, dataType: payload.dataType, color: payload.color });
	res.status(201).json({ success: true, status: presentStatus(status) });
}

export async function listStatuses(_req: Request, res: Response): Promise<void> {
	const statuses = await Status.find({ isDeleted: false }).sort({ createdAt: -1 });
	
	
	res.json({ success: true, statuses: statuses.map(presentStatus) });
}

export async function getStatus(req: Request, res: Response): Promise<void> {
	const { id } = req.params;
	const status = await Status.findById(id);
	if (!status || status.isDeleted) {
		res.status(404).json({ success: false, message: "Status not found" });
		return;
	}
	res.json({ success: true, status: presentStatus(status) });
}

export async function updateStatus(req: Request, res: Response): Promise<void> {
	const { id } = req.params;
	const parsed = updateSchema.safeParse(req.body);
	if (!parsed.success) {
		res.status(400).json({ success: false, message: "Invalid payload", errors: parsed.error.flatten() });
		return;
	}
	const updates: Record<string, unknown> = {};
	const d = parsed.data as any;
	if (d.name !== undefined) {
		const existing = await Status.findOne({ _id: { $ne: id }, name: { $regex: `^${d.name}$`, $options: "i" }, isDeleted: false });
		if (existing) {
			res.status(409).json({ success: false, message: "Status name already exists" });
			return;
		}
		updates.name = d.name;
	}
	if (d.dataType !== undefined) updates.dataType = d.dataType;
	if (d.color !== undefined) updates.color = d.color;
	if (d.isDeleted !== undefined) updates.isDeleted = d.isDeleted;
	const status = await Status.findByIdAndUpdate(id, updates, { new: true });
	if (!status) {
		res.status(404).json({ success: false, message: "Status not found" });
		return;
	}
	res.json({ success: true, status: presentStatus(status) });
}

export async function softDeleteStatus(req: Request, res: Response): Promise<void> {
	const { id } = req.params;
	if (!id || !mongoose.Types.ObjectId.isValid(id)) {
		res.status(400).json({ success: false, message: "Invalid id" });
		return;
	}
	const status = await Status.findByIdAndUpdate(id, { isDeleted: true }, { new: true });
	if (!status) {
		res.status(404).json({ success: false, message: "Status not found" });
		return;
	}
	res.status(200).json({ success: true });
}



