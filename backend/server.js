import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectDB, getData } from './config/db.js';

// Импортируем роутеры
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import appointmentRoutes from './routes/appointmentRoutes.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Настройка CORS
app.use(cors({
  origin: ['http://localhost:5500', 'http://127.0.0.1:5500', 'http://localhost:3000'],
  credentials: true
}));

app.use(express.json());

// Логирование запросов
app.use((req, res, next) => {
  console.log(`📨 ${req.method} ${req.url}`);
  next();
});

// Подключаем роутеры
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/appointments', appointmentRoutes);

// Маршрут для корня
app.get('/', (req, res) => {
  res.json({
    message: 'API сервер калькулятора ОСАГО',
    endpoints: {
      auth: '/api/auth',
      users: '/api/users',
      test: '/api/test'
    }
  });
});

app.listen(PORT, () => {
  console.log(`✅ Сервер запущен по адресу: http://localhost:${PORT}`);
  connectDB();
});