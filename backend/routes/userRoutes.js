import express from 'express'
import { addUser, getUsers } from '../controllers/userControllers.js';

// Создаём роутер
const router = express.Router();

// Маршрут: GET /api/users
// Когда клиент отправляет GET запрос на /api/users, вызывается функция getUsers
router.get('/', getUsers);

// Маршрут: POST /api/users
// Когда клиент отправляет POST запрос на /api/users, вызывается функция addUser
router.post('/', addUser);

export default router