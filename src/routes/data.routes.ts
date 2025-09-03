import { Router } from "express";
import { importData, getData, updateDataStatus, updateCallClickTime, updateWhatsappClickTime, updateRemarks, submitForm, updateRow } from "../controllers/data.controller";
import { authenticate, requireAdmin } from "../middleware/auth";

export const dataRouter = Router();
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


