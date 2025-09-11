import { Router } from "express";
import {
  submitForm,
  updateForm,
  getFormData,
} from "../controllers/data.controller";

export const publicRouter = Router();

publicRouter.route("/form").post(submitForm).put(updateForm).get(getFormData);
