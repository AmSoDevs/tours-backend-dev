import { Router } from "express";
import { importData, getData, updateDataStatus, updateCallClickTime, updateWhatsappClickTime, updateRemarks, submitForm, updateRow, getStaffAssignedData, updateStaffDataStatus, updateStaffCallClickTime, updateStaffWhatsappClickTime, updateStaffRemarks, updateStaffRow, resetStaffAssignment, getStaffAssignmentStatus } from "../controllers/data.controller";
import { authenticate, requireAdmin, requireStaff } from "../middleware/auth";

export const dataRouter = Router();

dataRouter.get("/staff/:id", authenticate, requireStaff, getStaffAssignedData);

dataRouter.put("/staff/:id/status", authenticate, requireStaff, updateStaffDataStatus);
dataRouter.put("/staff/:id/call-click", authenticate, requireStaff, updateStaffCallClickTime);
dataRouter.put("/staff/:id/whatsapp-click", authenticate, requireStaff, updateStaffWhatsappClickTime);
dataRouter.put("/staff/:id/remarks", authenticate, requireStaff, updateStaffRemarks);
dataRouter.put("/staff/:id/row", authenticate, requireStaff, updateStaffRow);

dataRouter.use(authenticate, requireAdmin);
dataRouter.post("/import", importData);

dataRouter.get("/", getData);

dataRouter.put("/status", updateDataStatus);

dataRouter.put("/call-click", updateCallClickTime);

dataRouter.put("/whatsapp-click", updateWhatsappClickTime);

dataRouter.put("/remarks", updateRemarks);

dataRouter.put("/row", updateRow);


dataRouter.get("/staff-assignment/status", getStaffAssignmentStatus);
dataRouter.post("/staff-assignment/reset", resetStaffAssignment);


