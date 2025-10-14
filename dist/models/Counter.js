"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Counter = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const counterSchema = new mongoose_1.default.Schema({
    prefix: { type: String, required: true, unique: true },
    seq: { type: Number, default: 100000 },
});
exports.Counter = mongoose_1.default.model("Counter", counterSchema);
//# sourceMappingURL=Counter.js.map