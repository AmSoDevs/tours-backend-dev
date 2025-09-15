"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registrationRouter = void 0;
const express_1 = require("express");
const formTracking_controller_1 = require("../controllers/formTracking.controller");
const auth_1 = require("../middleware/auth");
exports.registrationRouter = (0, express_1.Router)();
exports.registrationRouter.use(auth_1.authenticate);
exports.registrationRouter.post("/share", formTracking_controller_1.trackFormShare);
// Admin routes (require admin authentication)
exports.registrationRouter.use(auth_1.requireAdmin);
//# sourceMappingURL=registration.routes.js.map