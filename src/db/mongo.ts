import mongoose from "mongoose";
import { config } from "../config";

let isConnected = false;

export async function connectMongo(): Promise<void> {
	if (isConnected) return;
	mongoose.set("strictQuery", true);
	try {
		await mongoose.connect(config.database.mongoUri, {
			serverSelectionTimeoutMS: 5000,
		});
		isConnected = true;
		// eslint-disable-next-line no-console
		console.log(`MongoDB connected: ${mongoose.connection.host}/${mongoose.connection.name}`);

		mongoose.connection.on("disconnected", () => {
			// eslint-disable-next-line no-console
			console.error("MongoDB disconnected");
			isConnected = false;
		});
		mongoose.connection.on("error", (err) => {
			// eslint-disable-next-line no-console
			console.error("MongoDB error:", err);
		});
	} catch (err) {
		// eslint-disable-next-line no-console
		console.error("Failed to connect to MongoDB.", {
			uri: config.database.mongoUri,
			message: (err as Error).message,
		});
		throw err;
	}
}
