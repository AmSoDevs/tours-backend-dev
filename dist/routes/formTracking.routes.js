"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formTrackingRouter = void 0;
const express_1 = require("express");
const formTracking_controller_1 = require("../controllers/formTracking.controller");
const auth_1 = require("../middleware/auth");
exports.formTrackingRouter = (0, express_1.Router)();
// Public route for tracking form shares (no authentication required)
exports.formTrackingRouter.post("/share", formTracking_controller_1.trackFormShare);
// Public route for updating form submissions (no authentication required)
exports.formTrackingRouter.post("/submit", formTracking_controller_1.updateFormSubmission);
// Admin routes (require admin authentication)
exports.formTrackingRouter.use(auth_1.authenticate, auth_1.requireAdmin);
// Staff routes (require staff authentication)
//# sourceMappingURL=formTracking.routes.js.map