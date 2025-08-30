"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.apiRouter = void 0;
const express_1 = require("express");
exports.apiRouter = (0, express_1.Router)();
exports.apiRouter.get("/", (_req, res) => {
    res.json({ message: "CRM API v1" });
});
//# sourceMappingURL=index.js.map