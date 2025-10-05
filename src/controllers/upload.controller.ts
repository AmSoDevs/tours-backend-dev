import { Request, Response } from 'express';
import multer from 'multer';
import { uploadToSpaces, deleteFromSpaces } from '../config/spaces';
import { config } from '../config';
import { Files } from '../models/File.model';
import { Data } from '../models/Data';
import { Staff } from '../models/Staff';

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

    const fileInput = {
      url: imageUrl,
      title: req.body.title || '',
      uploadedBy: req.body.uploadedBy || null,
      context: req.body.context || 'other',
      staffId: req.body.staffId || null,
      dataId: req.body.dataId || null,
    }

    const file = await Files.create(fileInput);

    if(req.body.context==="data"){

      const existingData = await Data.findById(req.body.dataId);
     
      const  existingFiles = existingData?.files || [];
      existingFiles.push(file._id);

      await Data.findByIdAndUpdate(
        req.body.dataId,
        { $set: { files: existingFiles } }
      );

    }

    if (req.body.context==="staff"){

      const existingData = await Staff.findById(req.body.staffId);
      const  existingFiles = existingData?.files || [];
      existingFiles.push(file._id);

      await Staff.findByIdAndUpdate(
        req.body.staffId,
        { $set: { files: existingFiles } }
      );


    }

    res.status(200).json({
      success: true,
      message: 'Image uploaded successfully',
      imageUrl: imageUrl,
      file,
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
    const { imageUrl, fileId } = req.body;

    if (!imageUrl && !fileId) {
      return res.status(400).json({
        success: false,
        message: 'Image URL or Id is required',
      });
    }

    if(imageUrl){

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

    }

    if (fileId){
     
      const fileDetails = await Files.findById(fileId);
      if(!fileDetails){
        return res.status(404).json({
          success: false,
          message: 'File not found',
        });
      }
      const fileUrl = fileDetails.url;
      const inUse = await Data.findOne({ profilePhoto: fileUrl });
    
      if (inUse) {
        return res.status(400).json({
          success: false,
          message: 'Image is still in use and cannot be deleted',
        });
      } 

      await Files.findByIdAndDelete(fileId);
      await Data.updateMany(
        { files: fileId },
        { $pull: { files: fileId } }
      );
      await Staff.updateMany(
        { files: fileId },
        { $pull: { files: fileId } }
      );
      await deleteFromSpaces(fileUrl);
      res.status(200).json({
        success: true,
        message: 'Image deleted successfully',
      });
    }

  
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
