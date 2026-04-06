// backend/routes/adminRoutes.js
import express from 'express';
import { authenticate } from '../middleware/authMiddleware.js';
import { isAdmin } from '../middleware/adminMiddleware.js';
import {
    getAllAppointments,
    getAppointmentDetails,
    searchUsers,
    updateAppointmentStatus,
    getAppointmentStats
} from '../controllers/adminController.js';

const router = express.Router();

// Все маршруты требуют аутентификации и прав администратора
router.use(authenticate);
router.use(isAdmin);

// Статистика
router.get('/stats', getAppointmentStats);

// Записи на приём
router.get('/appointments', getAllAppointments);
router.get('/appointments/:id', getAppointmentDetails);
router.put('/appointments/:id/status', updateAppointmentStatus);

// Поиск пользователей
router.get('/users/search', searchUsers);

export default router;