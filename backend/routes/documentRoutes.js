import express from 'express';
import { authenticate } from '../middleware/authMiddleware.js';
import { uploadDocuments, handleMulterError } from '../middleware/uploadMiddleware.js';
import { isAdmin } from '../middleware/adminMiddleware.js';
import {
    uploadUserDocuments,
    getDocumentsForVerification,
    verifyDocumentsAndCreatePolicy
} from '../controllers/documentController.js';
import { sendPolicyEmail } from '../controllers/emailController.js';

const router = express.Router();

// Загрузка документов (только авторизованные)
router.post('/upload', 
    authenticate, 
    (req, res, next) => {
        console.log('🔐 Запрос на загрузку документов от пользователя:', req.user?.userId);
        next();
    },
    uploadDocuments, 
    handleMulterError,
    uploadUserDocuments
);

// Остальные маршруты...
router.get('/pending-verification', authenticate, isAdmin, getDocumentsForVerification);
router.put('/verify/:applicationId', authenticate, isAdmin, verifyDocumentsAndCreatePolicy);
router.post('/send-policy/:applicationId', authenticate, isAdmin, sendPolicyEmail);

export default router;