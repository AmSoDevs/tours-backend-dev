"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
const zod_1 = require("zod");
dotenv_1.default.config();
const envSchema = zod_1.z.object({
    NODE_ENV: zod_1.z.enum(["development", "test", "production"]).default("development"),
    PORT: zod_1.z
        .string()
        .default("4000")
        .transform((p) => Number(p))
        .pipe(zod_1.z.number().int().min(1).max(65535)),
    MONGO_URI: zod_1.z.string().default("mongodb+srv://sahad:sahad8878@cluster0.fzwc4bd.mongodb.net/crm"),
    ADMIN_NAME: zod_1.z.string().default("Admin"),
    ADMIN_EMAIL: zod_1.z.string().email().default("admin@example.com"),
    ADMIN_PASSWORD: zod_1.z.string().min(6).default("admin123"),
    JWT_SECRET: zod_1.z.string().min(8).default("dev-secret-key"),
    JWT_EXPIRES_IN: zod_1.z.string().default("1d"),
    FRONTEND_URLS: zod_1.z.string().default("https://tourcrm.netlify.app,https://google.malayalimarriage.com,http://localhost:3000"),
});
const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
    // eslint-disable-next-line no-console
    console.error("Invalid environment variables:", parsed.error.flatten().fieldErrors);
    process.exit(1);
}
exports.config = {
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
//# sourceMappingURL=index.js.map