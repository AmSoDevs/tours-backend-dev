"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = errorHandler;
function errorHandler(err, req, res, next) {
    if (res.headersSent) {
        return next(err);
    }
    const status = err?.statusCode || 500;
    const message = err?.message || "Internal Server Error";
    const details = err?.details;
    res.status(status).json({
        success: false,
        message,
        ...(details ? { details } : {}),
    });
}
//# sourceMappingURL=errorHandler.js.map