"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.staffRouter = void 0;
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const staff_controller_1 = require("../controllers/staff.controller");
const auth_controller_1 = require("../controllers/auth.controller");
exports.staffRouter = (0, express_1.Router)();
// Public route for staff login (no authentication required)
exports.staffRouter.post("/login", auth_controller_1.staffLogin);
// Protected routes (require admin authentication)
exports.staffRouter.use(auth_1.authenticate, auth_1.requireAdmin);
exports.staffRouter
    .route("/")
    .get(staff_controller_1.listStaff)
    .post(staff_controller_1.createStaff);
exports.staffRouter
    .route("/:id")
    .get(staff_controller_1.getStaff)
    .patch(staff_controller_1.updateStaff)
    .delete(staff_controller_1.softDeleteStaff);
//# sourceMappingURL=staff.routes.js.map