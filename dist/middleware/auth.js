"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticate = authenticate;
exports.requireAdmin = requireAdmin;
exports.requireStaff = requireStaff;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const config_1 = require("../config");
function authenticate(req, res, next) {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith("Bearer ")) {
        res.status(401).json({ success: false, message: "Missing or invalid Authorization header" });
        return;
    }
    const token = auth.substring("Bearer ".length);
    try {
        const decoded = jsonwebtoken_1.default.verify(token, config_1.config.auth.jwtSecret);
        req.user = decoded;
        next();
    }
    catch {
        res.status(401).json({ success: false, message: "Invalid or expired token" });
    }
}
function requireAdmin(req, res, next) {
    if (!req.user || req.user.role !== "admin") {
        res.status(403).json({ success: false, message: "Admin privileges required" });
        return;
    }
    next();
}
function requireStaff(req, res, next) {
    if (!req.user || req.user.role !== "staff") {
        res.status(403).json({ success: false, message: "Staff privileges required" });
        return;
    }
    next();
}
//# sourceMappingURL=auth.js.map