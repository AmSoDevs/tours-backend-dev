"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.apiRouter = void 0;
const express_1 = require("express");
const auth_routes_1 = require("./auth.routes");
const staff_routes_1 = require("./staff.routes");
const status_routes_1 = require("./status.routes");
const data_routes_1 = require("./data.routes");
const public_routes_1 = require("./public.routes");
const formTracking_routes_1 = require("./formTracking.routes");
exports.apiRouter = (0, express_1.Router)();
exports.apiRouter.get("/", (_req, res) => {
    res.json({ message: "CRM API v1" });
});
exports.apiRouter.use("/auth", auth_routes_1.authRouter);
exports.apiRouter.use("/staff", staff_routes_1.staffRouter);
exports.apiRouter.use("/status", status_routes_1.statusRouter);
exports.apiRouter.use("/data", data_routes_1.dataRouter);
exports.apiRouter.use("/public", public_routes_1.publicRouter);
exports.apiRouter.use("/form-tracking", formTracking_routes_1.formTrackingRouter);
//# sourceMappingURL=index.js.map