"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.apiRouter = void 0;
const express_1 = require("express");
const auth_routes_1 = require("./auth.routes");
const staff_routes_1 = require("./staff.routes");
const status_routes_1 = require("./status.routes");
const data_routes_1 = require("./data.routes");
const public_routes_1 = require("./public.routes");
const registration_routes_1 = require("./registration.routes");
const upload_routes_1 = require("./upload.routes");
const cleanup_routes_1 = __importDefault(require("./cleanup.routes"));
exports.apiRouter = (0, express_1.Router)();
exports.apiRouter.get("/", (_req, res) => {
    res.json({ message: "CRM API v1" });
});
exports.apiRouter.use("/auth", auth_routes_1.authRouter);
exports.apiRouter.use("/staff", staff_routes_1.staffRouter);
exports.apiRouter.use("/status", status_routes_1.statusRouter);
exports.apiRouter.use("/data", data_routes_1.dataRouter);
exports.apiRouter.use("/public", public_routes_1.publicRouter);
exports.apiRouter.use("/registration", registration_routes_1.registrationRouter);
exports.apiRouter.use("/upload", upload_routes_1.uploadRouter);
exports.apiRouter.use("/cleanup", cleanup_routes_1.default);
//# sourceMappingURL=index.js.map