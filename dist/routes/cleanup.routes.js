"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const cleanup_controller_1 = require("../controllers/cleanup.controller");
const cleanupRouter = (0, express_1.Router)();
// Cleanup routes (admin only)
cleanupRouter.get('/stats', auth_1.authenticate, auth_1.requireAdmin, cleanup_controller_1.getCleanupStats);
cleanupRouter.post('/orphaned', auth_1.authenticate, auth_1.requireAdmin, cleanup_controller_1.cleanupOrphanedImages);
cleanupRouter.post('/delete', auth_1.authenticate, auth_1.requireAdmin, cleanup_controller_1.deleteImage);
exports.default = cleanupRouter;
//# sourceMappingURL=cleanup.routes.js.map