import { Router } from "express";
import { submitForm, updateForm } from "../controllers/data.controller";

export const publicRouter = Router();

// Public form submission endpoint (no authentication required)
publicRouter.post("/submit-form", submitForm);
publicRouter.put("/update-form", updateForm);
