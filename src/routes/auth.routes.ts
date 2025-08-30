import { Router } from "express";
import { adminLogin, staffLogin } from "../controllers/auth.controller";

export const authRouter = Router();

authRouter.post("/login", adminLogin);
authRouter.post("/staff/login", staffLogin);
