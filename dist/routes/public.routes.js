"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.publicRouter = void 0;
const express_1 = require("express");
const data_controller_1 = require("../controllers/data.controller");
exports.publicRouter = (0, express_1.Router)();
// Public form submission endpoint (no authentication required)
exports.publicRouter.post("/submit-form", data_controller_1.submitForm);
exports.publicRouter.put("/update-form", data_controller_1.updateForm);
//# sourceMappingURL=public.routes.js.map