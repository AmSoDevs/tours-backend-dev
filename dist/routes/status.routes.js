"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.statusRouter = void 0;
const express_1 = require("express");
const status_controller_1 = require("../controllers/status.controller");
const auth_1 = require("../middleware/auth");
exports.statusRouter = (0, express_1.Router)();
// Staff route to read status data (for filtering purposes)
exports.statusRouter.get("/staff/:id", auth_1.authenticate, auth_1.requireStaff, status_controller_1.listStatuses);
// Admin routes (require admin authentication)
exports.statusRouter.use(auth_1.authenticate, auth_1.requireAdmin);
exports.statusRouter
    .route("/")
    .get(status_controller_1.listStatuses)
    .post(status_controller_1.createStatus);
exports.statusRouter
    .route("/:id")
    .get(status_controller_1.getStatus)
    .patch(status_controller_1.updateStatus)
    .delete(status_controller_1.softDeleteStatus);
//# sourceMappingURL=status.routes.js.map