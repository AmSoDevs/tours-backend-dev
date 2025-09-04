"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dataRouter = void 0;
const express_1 = require("express");
const data_controller_1 = require("../controllers/data.controller");
const auth_1 = require("../middleware/auth");
exports.dataRouter = (0, express_1.Router)();
// Staff route to get their assigned data (requires authentication)
exports.dataRouter.get("/staff/:id", auth_1.authenticate, auth_1.requireStaff, data_controller_1.getStaffAssignedData);
// Staff update routes (require staff authentication)
exports.dataRouter.put("/staff/:id/status", auth_1.authenticate, auth_1.requireStaff, data_controller_1.updateStaffDataStatus);
exports.dataRouter.put("/staff/:id/call-click", auth_1.authenticate, auth_1.requireStaff, data_controller_1.updateStaffCallClickTime);
exports.dataRouter.put("/staff/:id/whatsapp-click", auth_1.authenticate, auth_1.requireStaff, data_controller_1.updateStaffWhatsappClickTime);
exports.dataRouter.put("/staff/:id/remarks", auth_1.authenticate, auth_1.requireStaff, data_controller_1.updateStaffRemarks);
exports.dataRouter.put("/staff/:id/row", auth_1.authenticate, auth_1.requireStaff, data_controller_1.updateStaffRow);
// Admin routes (require admin authentication)
exports.dataRouter.use(auth_1.authenticate, auth_1.requireAdmin);
// Import data endpoint
exports.dataRouter.post("/import", data_controller_1.importData);
// Get data endpoint with pagination and filtering
exports.dataRouter.get("/", data_controller_1.getData);
// Update data status endpoint
exports.dataRouter.put("/status", data_controller_1.updateDataStatus);
// Update call click time endpoint
exports.dataRouter.put("/call-click", data_controller_1.updateCallClickTime);
// Update WhatsApp click time endpoint
exports.dataRouter.put("/whatsapp-click", data_controller_1.updateWhatsappClickTime);
// Update remarks endpoint
exports.dataRouter.put("/remarks", data_controller_1.updateRemarks);
// Update individual row endpoint
exports.dataRouter.put("/row", data_controller_1.updateRow);
//# sourceMappingURL=data.routes.js.map