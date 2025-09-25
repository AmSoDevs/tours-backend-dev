"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
const notFound_1 = require("./middleware/notFound");
const errorHandler_1 = require("./middleware/errorHandler");
const routes_1 = require("./routes");
const config_1 = require("./config");
exports.app = (0, express_1.default)();
// Core middleware
exports.app.use((0, helmet_1.default)());
const corsOptions = {
    origin: config_1.config.cors.frontendUrls,
    credentials: true,
    optionsSuccessStatus: 200
};
exports.app.use((0, cors_1.default)(corsOptions));
exports.app.use(express_1.default.json({ limit: "1mb" }));
exports.app.use(express_1.default.urlencoded({ extended: true }));
exports.app.use((0, morgan_1.default)("dev"));
// Healthcheck
exports.app.get("/health", (_req, res) => {
    res.status(200).json({ status: "ok" });
});
// API v1
exports.app.use("/api/v1", routes_1.apiRouter);
// 404 and error handling
exports.app.use(notFound_1.notFoundHandler);
exports.app.use(errorHandler_1.errorHandler);
//# sourceMappingURL=app.js.map