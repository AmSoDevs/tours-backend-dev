import { Request, Response } from 'express';
import { deleteFromSpaces } from '../config/spaces';
import { Data } from '../models/Data';

export const cleanupOrphanedImages = async (req: Request, res: Response) => {
  try {
    console.log('Starting orphaned images cleanup...');
    
    // Get all image URLs from the database
    const dataRecords = await Data.find({ 
      profilePhoto: { $exists: true, $ne: "" } 
    }).select('profilePhoto');
    
    const usedImageUrls = new Set(
      dataRecords.map(record => record.profilePhoto).filter(Boolean)
    );
    
    console.log(`Found ${usedImageUrls.size} images in use`);
    
  
    
    return res.status(200).json({
      success: true,
      message: 'Cleanup completed',
      data: {
        usedImages: usedImageUrls.size,
        usedImageUrls: Array.from(usedImageUrls)
      }
    });
    
  } catch (error: any) {
    console.error('Error during cleanup:', error);
    return res.status(500).json({
      success: false,
      message: 'Error during cleanup',
      error: error.message
    });
  }
};


export const deleteImage = async (req: Request, res: Response) => {
  try {
    const { imageUrl } = req.body;
    
    if (!imageUrl) {
      return res.status(400).json({
        success: false,
        message: 'Image URL is required'
      });
    }
    
    const inUse = await Data.findOne({ profilePhoto: imageUrl });
    if (inUse) {
      return res.status(400).json({
        success: false,
        message: 'Image is still in use and cannot be deleted'
      });
    }
    
    // Delete from S3
    await deleteFromSpaces(imageUrl);
    
    return res.status(200).json({
      success: true,
      message: 'Image deleted successfully'
    });
    
  } catch (error: any) {
    console.error('Error deleting image:', error);
    return res.status(500).json({
      success: false,
      message: 'Error deleting image',
      error: error.message
    });
  }
};

// Get cleanup statistics
export const getCleanupStats = async (req: Request, res: Response) => {
  try {
    const totalRecords = await Data.countDocuments({});
    const recordsWithImages = await Data.countDocuments({ 
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
    
  } catch (error: any) {
    console.error('Error getting cleanup stats:', error);
    return res.status(500).json({
      success: false,
      message: 'Error getting cleanup stats',
      error: error.message
    });
  }
};
