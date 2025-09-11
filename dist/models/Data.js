"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.Data = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const DataSchema = new mongoose_1.Schema({
    slNo: { type: String, required: true },
    profileId: { type: String },
    dataType: { type: String },
    data: { type: String },
    verified: { type: String },
    mobile: { type: String, required: true, index: true },
    name: { type: String },
    remarkFirst: { type: String },
    status: { type: String },
    refferenceNumber: { type: String },
    refferenceName: { type: String },
    remarkSecond: { type: String },
    assignedStaff: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "Staff",
        required: true,
    },
    isDeleted: { type: Boolean, default: false, index: true },
    reminderDateAndTime: { type: Date },
    callClickTime: { type: Date },
    whatsappClickTime: { type: Date },
    refferenceCallClickTime: { type: Date },
    refferenceWhatsappClickTime: { type: Date },
    preferCountry: { type: String },
    preferJobs: { type: String },
    searchedHouses: { type: String },
    gender: { type: String },
    dateOfBirth: { type: String },
    maritalStatus: { type: String },
    religion: { type: String },
    education: { type: String },
    jobType: { type: String },
    monthlyIncome: { type: String },
    spokenLanguage: { type: String },
    district: { type: String },
    city: { type: String },
    expectations: { type: String },
    createProfileFor: { type: String },
    contactPersonName: { type: String },
    regPayment: { type: String },
    visaPay: { type: String },
    regReceived: { type: String },
    payReceived: { type: String },
    regBalance: { type: String },
    payBalance: { type: String },
    passportNo: { type: String },
    vSampleSend: { type: String },
    processing: { type: String },
    visaDate: { type: String },
    profilePhoto: { type: String },
}, { timestamps: true });
DataSchema.index({ mobile: 1 }, { unique: true });
DataSchema.index({ slNo: 1 }, { unique: true });
DataSchema.index({ profileId: 1 }, { unique: true });
exports.Data = mongoose_1.default.models.Data || mongoose_1.default.model("Data", DataSchema);
//# sourceMappingURL=Data.js.map