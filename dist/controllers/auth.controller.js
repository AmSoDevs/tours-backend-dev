"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminLogin = adminLogin;
exports.staffLogin = staffLogin;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const zod_1 = require("zod");
const config_1 = require("../config");
const Admin_1 = require("../models/Admin");
const Staff_1 = require("../models/Staff");
const loginSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(1),
});
const staffLoginSchema = zod_1.z.object({
    emailOrUsername: zod_1.z.string().min(1),
    password: zod_1.z.string().min(1),
});
async function adminLogin(req, res) {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ success: false, message: "Invalid payload", errors: parsed.error.flatten() });
        return;
    }
    const { email, password } = parsed.data;
    const admin = await Admin_1.Admin.findOne({ email });
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
        role: "admin",
        name: admin.name,
        email: admin.email,
    };
    const secret = config_1.config.auth.jwtSecret;
    const expiresIn = config_1.config.auth.jwtExpiresIn;
    const options = { expiresIn };
    const token = jsonwebtoken_1.default.sign(payload, secret, options);
    res.status(200).json({
        success: true,
        user: { name: admin.name, email: admin.email, role: "admin" },
        token,
    });
}
async function staffLogin(req, res) {
    const parsed = staffLoginSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ success: false, message: "Invalid payload", errors: parsed.error.flatten() });
        return;
    }
    const { emailOrUsername, password } = parsed.data;
    // Search for staff by either email or username
    const staff = await Staff_1.Staff.findOne({
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
        role: "staff",
        name: staff.name,
        email: staff.email,
        username: staff.username,
        staffId: staff.staffId,
    };
    const secret = config_1.config.auth.jwtSecret;
    const expiresIn = config_1.config.auth.jwtExpiresIn;
    const options = { expiresIn };
    const token = jsonwebtoken_1.default.sign(payload, secret, options);
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
//# sourceMappingURL=auth.controller.js.map