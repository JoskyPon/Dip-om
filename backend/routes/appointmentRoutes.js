import express from 'express'
import { authenticate } from '../middleware/authMiddleware.js';
import { createAppointment, checkAvailableTime, getUserAppointments } from '../controllers/appointmentController.js';

const router = express.Router();

// Проверка доступного времени (публичный маршрут)
router.get('/check-time', checkAvailableTime);

// Создание записи на приём (только для авторизованных)
router.post('/', authenticate, createAppointment);

router.get('/my', authenticate, getUserAppointments);

// Экспортируем роутер
export default router