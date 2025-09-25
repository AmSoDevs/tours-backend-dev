"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadRouter = void 0;
const express_1 = require("express");
const upload_controller_1 = require("../controllers/upload.controller");
exports.uploadRouter = (0, express_1.Router)();
// Upload single image
exports.uploadRouter.post('/single', upload_controller_1.uploadSingle, upload_controller_1.uploadImage);
// Delete image
exports.uploadRouter.post('/delete', upload_controller_1.deleteImage);
//# sourceMappingURL=upload.routes.js.map