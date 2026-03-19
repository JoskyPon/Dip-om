import express from 'express'
import { authenticate } from '../middleware/authMiddleware.js';
import { getUserDashboard, getVehicleDetails } from '../controllers/userControllers.js';

const router = express.Router();

router.use(authenticate);

// Основной дашборд
router.get('/dashboard', getUserDashboard);

// Детали конкретного автомобиля
router.get('/vehicles/:registrationNumber', getVehicleDetails);

export default router