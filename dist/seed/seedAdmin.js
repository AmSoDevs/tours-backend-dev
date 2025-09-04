"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureAdminSeeded = ensureAdminSeeded;
const bcrypt_1 = __importDefault(require("bcrypt"));
const Admin_1 = require("../models/Admin");
const config_1 = require("../config");
async function ensureAdminSeeded() {
    const existing = await Admin_1.Admin.findOne({ email: config_1.config.admin.email });
    if (existing)
        return;
    const passwordHash = await bcrypt_1.default.hash(config_1.config.admin.password, 10);
    await Admin_1.Admin.create({ name: config_1.config.admin.name, email: config_1.config.admin.email, passwordHash });
}
//# sourceMappingURL=seedAdmin.js.map