import { Router } from 'express';
import { 
  uploadImage, 
  deleteImage,
  uploadSingle
} from '../controllers/upload.controller';

export const uploadRouter = Router();

// Upload single image
uploadRouter.post('/single', uploadSingle, uploadImage);

// Delete image
uploadRouter.post('/delete', deleteImage);
