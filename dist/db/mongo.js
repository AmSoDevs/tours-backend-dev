"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.connectMongo = connectMongo;
const mongoose_1 = __importDefault(require("mongoose"));
const config_1 = require("../config");
let isConnected = false;
async function connectMongo() {
    if (isConnected)
        return;
    mongoose_1.default.set("strictQuery", true);
    try {
        await mongoose_1.default.connect(config_1.config.database.mongoUri, {
            serverSelectionTimeoutMS: 5000,
        });
        isConnected = true;
        // eslint-disable-next-line no-console
        console.log(`MongoDB connected: ${mongoose_1.default.connection.host}/${mongoose_1.default.connection.name}`);
        mongoose_1.default.connection.on("disconnected", () => {
            // eslint-disable-next-line no-console
            console.error("MongoDB disconnected");
            isConnected = false;
        });
        mongoose_1.default.connection.on("error", (err) => {
            // eslint-disable-next-line no-console
            console.error("MongoDB error:", err);
        });
    }
    catch (err) {
        // eslint-disable-next-line no-console
        console.error("Failed to connect to MongoDB.", {
            uri: config_1.config.database.mongoUri,
            message: err.message,
        });
        throw err;
    }
}
//# sourceMappingURL=mongo.js.map