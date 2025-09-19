import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
	NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
	PORT: z
		.string()
		.default("4000")
		.transform((p) => Number(p))
		.pipe(z.number().int().min(1).max(65535)),
	MONGO_URI: z.string().default("mongodb+srv://sahad:sahad8878@cluster0.fzwc4bd.mongodb.net/crm"),
	ADMIN_NAME: z.string().default("Admin"),
	ADMIN_EMAIL: z.string().email().default("admin@example.com"),
	ADMIN_PASSWORD: z.string().min(6).default("admin123"),
	JWT_SECRET: z.string().min(8).default("dev-secret-key"),
	JWT_EXPIRES_IN: z.string().default("1d"),
	FRONTEND_URLS: z.string().default("https://tourcrm.netlify.app,https://google.malayalimarriage.com,http://localhost:3000"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
	// eslint-disable-next-line no-console
	console.error("Invalid environment variables:", parsed.error.flatten().fieldErrors);
	process.exit(1);
}

export const config = {
	env: parsed.data.NODE_ENV,
	port: parsed.data.PORT,
	database: {
		mongoUri: parsed.data.MONGO_URI,
	},
	admin: {
		name: parsed.data.ADMIN_NAME,
		email: parsed.data.ADMIN_EMAIL,
		password: parsed.data.ADMIN_PASSWORD,
	},
	auth: {
		jwtSecret: parsed.data.JWT_SECRET,
		jwtExpiresIn: parsed.data.JWT_EXPIRES_IN,
	},
	cors: {
		frontendUrls: parsed.data.FRONTEND_URLS.split(',').map(url => url.trim()),
	},
};
