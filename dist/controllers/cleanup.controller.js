"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCleanupStats = exports.deleteImage = exports.cleanupOrphanedImages = void 0;
const spaces_1 = require("../config/spaces");
const Data_1 = require("../models/Data");
const cleanupOrphanedImages = async (req, res) => {
    try {
        console.log('Starting orphaned images cleanup...');
        // Get all image URLs from the database
        const dataRecords = await Data_1.Data.find({
            profilePhoto: { $exists: true, $ne: "" }
        }).select('profilePhoto');
        const usedImageUrls = new Set(dataRecords.map(record => record.profilePhoto).filter(Boolean));
        console.log(`Found ${usedImageUrls.size} images in use`);
        return res.status(200).json({
            success: true,
            message: 'Cleanup completed',
            data: {
                usedImages: usedImageUrls.size,
                usedImageUrls: Array.from(usedImageUrls)
            }
        });
    }
    catch (error) {
        console.error('Error during cleanup:', error);
        return res.status(500).json({
            success: false,
            message: 'Error during cleanup',
            error: error.message
        });
    }
};
exports.cleanupOrphanedImages = cleanupOrphanedImages;
const deleteImage = async (req, res) => {
    try {
        const { imageUrl } = req.body;
        if (!imageUrl) {
            return res.status(400).json({
                success: false,
                message: 'Image URL is required'
            });
        }
        const inUse = await Data_1.Data.findOne({ profilePhoto: imageUrl });
        if (inUse) {
            return res.status(400).json({
                success: false,
                message: 'Image is still in use and cannot be deleted'
            });
        }
        // Delete from S3
        await (0, spaces_1.deleteFromSpaces)(imageUrl);
        return res.status(200).json({
            success: true,
            message: 'Image deleted successfully'
        });
    }
    catch (error) {
        console.error('Error deleting image:', error);
        return res.status(500).json({
            success: false,
            message: 'Error deleting image',
            error: error.message
        });
    }
};
exports.deleteImage = deleteImage;
// Get cleanup statistics
const getCleanupStats = async (req, res) => {
    try {
        const totalRecords = await Data_1.Data.countDocuments({});
        const recordsWithImages = await Data_1.Data.countDocuments({
            profilePhoto: { $exists: true, $ne: "" }
        });
        return res.status(200).json({
            success: true,
            data: {
                totalRecords,
                recordsWithImages,
                recordsWithoutImages: totalRecords - recordsWithImages
            }
        });
    }
    catch (error) {
        console.error('Error getting cleanup stats:', error);
        return res.status(500).json({
            success: false,
            message: 'Error getting cleanup stats',
            error: error.message
        });
    }
};
exports.getCleanupStats = getCleanupStats;
//# sourceMappingURL=cleanup.controller.js.map