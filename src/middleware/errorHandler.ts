import { NextFunction, Request, Response } from "express";

export function errorHandler(
	err: unknown,
	req: Request,
	res: Response,
	next: NextFunction
): void {
	if (res.headersSent) {
		return next(err as Error);
	}

	const status = (err as any)?.statusCode || 500;
	const message = (err as any)?.message || "Internal Server Error";
	const details = (err as any)?.details;

	res.status(status).json({
		success: false,
		message,
		...(details ? { details } : {}),
	});
}
