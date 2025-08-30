"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notFoundHandler = notFoundHandler;
function notFoundHandler(_req, res) {
    res.status(404).json({ success: false, message: "Not Found" });
}
//# sourceMappingURL=notFound.js.map