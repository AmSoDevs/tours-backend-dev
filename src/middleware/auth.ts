import { NextFunction, Request, Response } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";
import { config } from "../config";

export interface AuthUser extends JwtPayload {
	sub: string;
	role: "admin" | "staff";
	name: string;
	email: string;
}

export interface AuthenticatedRequest extends Request {
	user?: AuthUser;
}

export function authenticate(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
	const auth = req.headers.authorization;
	if (!auth || !auth.startsWith("Bearer ")) {
		res.status(401).json({ success: false, message: "Missing or invalid Authorization header" });
		return;
	}

	const token = auth.substring("Bearer ".length);
	try {
		const decoded = jwt.verify(token, config.auth.jwtSecret) as AuthUser;
		req.user = decoded;
		next();
	} catch {
		res.status(401).json({ success: false, message: "Invalid or expired token" });
	}
}

export function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
	if (!req.user || req.user.role !== "admin") {
		res.status(403).json({ success: false, message: "Admin privileges required" });
		return;
	}
	next();
}
