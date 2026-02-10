import express from 'express'
import { register, login, logout, profile, vehicles, policies, appointments } from '../controllers/authController.js'

const router = express.Router();

router.post('/register', register)

router.post('/login', login)

router.get('/logout', logout)

router.get('/profile', profile)

router.put('/profile', profile)

router.get('/vehicles', vehicles)

router.post('/vehicles', vehicles)

router.get('/policies', policies)

router.get('/appointments', appointments)

router.post('/appointments', appointments)

// Экспортируем роутер
export default router