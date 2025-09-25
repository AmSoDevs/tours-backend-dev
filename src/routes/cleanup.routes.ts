import { Router } from 'express';
import { authenticate, requireAdmin } from '../middleware/auth';
import { 
  cleanupOrphanedImages, 
  deleteImage, 
  getCleanupStats 
} from '../controllers/cleanup.controller';

const cleanupRouter = Router();

// Cleanup routes (admin only)
cleanupRouter.get('/stats', authenticate, requireAdmin, getCleanupStats);
cleanupRouter.post('/orphaned', authenticate, requireAdmin, cleanupOrphanedImages);
cleanupRouter.post('/delete', authenticate, requireAdmin, deleteImage);

export default cleanupRouter;
