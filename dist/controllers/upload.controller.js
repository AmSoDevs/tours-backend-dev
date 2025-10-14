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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadSingle = exports.deleteImage = exports.uploadImage = void 0;
const multer_1 = __importDefault(require("multer"));
const spaces_1 = require("../config/spaces");
const File_model_1 = require("../models/File.model");
const Data_1 = require("../models/Data");
const Staff_1 = require("../models/Staff");
const storage = multer_1.default.memoryStorage();
const upload = (0, multer_1.default)({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024,
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        }
        else {
            cb(null, false);
        }
    },
});
const uploadImage = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'No image file provided',
            });
        }
        if (!req.file.mimetype.startsWith('image/')) {
            return res.status(400).json({
                success: false,
                message: 'Only image files are allowed',
            });
        }
        const folder = req.body.folder || 'profile-photos';
        const imageUrl = await (0, spaces_1.uploadToSpaces)(req.file, folder);
        const fileInput = {
            url: imageUrl,
            title: req.body.title || '',
            uploadedBy: req.body.uploadedBy || null,
            context: req.body.context || 'other',
            staffId: req.body.staffId || null,
            dataId: req.body.dataId || null,
        };
        const file = await File_model_1.Files.create(fileInput);
        if (req.body.context === "data") {
            const existingData = await Data_1.Data.findById(req.body.dataId);
            const existingFiles = existingData?.files || [];
            existingFiles.push(file._id);
            await Data_1.Data.findByIdAndUpdate(req.body.dataId, { $set: { files: existingFiles } });
        }
        if (req.body.context === "staff") {
            const existingData = await Staff_1.Staff.findById(req.body.staffId);
            const existingFiles = existingData?.files || [];
            existingFiles.push(file._id);
            await Staff_1.Staff.findByIdAndUpdate(req.body.staffId, { $set: { files: existingFiles } });
        }
        res.status(200).json({
            success: true,
            message: 'Image uploaded successfully',
            imageUrl: imageUrl,
            file,
        });
    }
    catch (error) {
        console.error('Error uploading image:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to upload image',
            error: error.message,
        });
    }
};
exports.uploadImage = uploadImage;
const deleteImage = async (req, res) => {
    try {
        const { imageUrl, fileId } = req.body;
        if (!imageUrl && !fileId) {
            return res.status(400).json({
                success: false,
                message: 'Image URL or Id is required',
            });
        }
        if (imageUrl) {
            // Check if image is still in use in the database
            const { Data } = await Promise.resolve().then(() => __importStar(require('../models/Data')));
            const inUse = await Data.findOne({ profilePhoto: imageUrl });
            if (inUse) {
                return res.status(400).json({
                    success: false,
                    message: 'Image is still in use and cannot be deleted',
                });
            }
            await (0, spaces_1.deleteFromSpaces)(imageUrl);
            res.status(200).json({
                success: true,
                message: 'Image deleted successfully',
            });
        }
        if (fileId) {
            const fileDetails = await File_model_1.Files.findById(fileId);
            if (!fileDetails) {
                return res.status(404).json({
                    success: false,
                    message: 'File not found',
                });
            }
            const fileUrl = fileDetails.url;
            const inUse = await Data_1.Data.findOne({ profilePhoto: fileUrl });
            if (inUse) {
                return res.status(400).json({
                    success: false,
                    message: 'Image is still in use and cannot be deleted',
                });
            }
            await File_model_1.Files.findByIdAndDelete(fileId);
            await Data_1.Data.updateMany({ files: fileId }, { $pull: { files: fileId } });
            await Staff_1.Staff.updateMany({ files: fileId }, { $pull: { files: fileId } });
            await (0, spaces_1.deleteFromSpaces)(fileUrl);
            res.status(200).json({
                success: true,
                message: 'Image deleted successfully',
            });
        }
    }
    catch (error) {
        console.error('Error deleting image:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete image',
            error: error.message,
        });
    }
};
exports.deleteImage = deleteImage;
exports.uploadSingle = upload.single('image');
//# sourceMappingURL=upload.controller.js.map