"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.publicRouter = void 0;
const express_1 = require("express");
const data_controller_1 = require("../controllers/data.controller");
exports.publicRouter = (0, express_1.Router)();
exports.publicRouter.route("/form").post(data_controller_1.submitForm).put(data_controller_1.updateForm).get(data_controller_1.getFormData);
//# sourceMappingURL=public.routes.js.map