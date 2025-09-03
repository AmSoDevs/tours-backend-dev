import { Router } from "express";
import { importData, getData, updateDataStatus, updateCallClickTime, updateWhatsappClickTime, updateRemarks, submitForm, updateRow, getStaffAssignedData, updateStaffDataStatus, updateStaffCallClickTime, updateStaffWhatsappClickTime, updateStaffRemarks, updateStaffRow } from "../controllers/data.controller";
import { authenticate, requireAdmin, requireStaff } from "../middleware/auth";

export const dataRouter = Router();

// Staff route to get their assigned data (requires authentication)
dataRouter.get("/staff/:id", authenticate, requireStaff, getStaffAssignedData);

// Staff update routes (require staff authentication)
dataRouter.put("/staff/:id/status", authenticate, requireStaff, updateStaffDataStatus);
dataRouter.put("/staff/:id/call-click", authenticate, requireStaff, updateStaffCallClickTime);
dataRouter.put("/staff/:id/whatsapp-click", authenticate, requireStaff, updateStaffWhatsappClickTime);
dataRouter.put("/staff/:id/remarks", authenticate, requireStaff, updateStaffRemarks);
dataRouter.put("/staff/:id/row", authenticate, requireStaff, updateStaffRow);

// Admin routes (require admin authentication)
dataRouter.use(authenticate, requireAdmin);
// Import data endpoint
dataRouter.post("/import", importData);

// Get data endpoint with pagination and filtering
dataRouter.get("/", getData);

// Update data status endpoint
dataRouter.put("/status", updateDataStatus);

// Update call click time endpoint
dataRouter.put("/call-click", updateCallClickTime);

// Update WhatsApp click time endpoint
dataRouter.put("/whatsapp-click", updateWhatsappClickTime);

// Update remarks endpoint
dataRouter.put("/remarks", updateRemarks);

// Update individual row endpoint
dataRouter.put("/row", updateRow);


