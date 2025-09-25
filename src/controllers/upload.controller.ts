import { Request, Response } from 'express';
import multer from 'multer';
import { uploadToSpaces, deleteFromSpaces } from '../config/spaces';
import { config } from '../config';

const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, 
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(null, false);
    }
  },
});

export const uploadImage = async (req: Request, res: Response) => {
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
    const imageUrl = await uploadToSpaces(req.file, folder);

    res.status(200).json({
      success: true,
      message: 'Image uploaded successfully',
      imageUrl: imageUrl,
    });
  } catch (error: any) {
    console.error('Error uploading image:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload image',
      error: error.message,
    });
  }
};


export const deleteImage = async (req: Request, res: Response) => {
  try {
    const { imageUrl } = req.body;

    if (!imageUrl) {
      return res.status(400).json({
        success: false,
        message: 'Image URL is required',
      });
    }

    // Check if image is still in use in the database
    const { Data } = await import('../models/Data');
    const inUse = await Data.findOne({ profilePhoto: imageUrl });
    
    if (inUse) {
      return res.status(400).json({
        success: false,
        message: 'Image is still in use and cannot be deleted',
      });
    }

    await deleteFromSpaces(imageUrl);

    res.status(200).json({
      success: true,
      message: 'Image deleted successfully',
    });
  } catch (error: any) {
    console.error('Error deleting image:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete image',
      error: error.message,
    });
  }
};

export const uploadSingle = upload.single('image');
