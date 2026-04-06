import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectDB } from './config/db.js';
import path from 'path';
import { fileURLToPath } from 'url';
import nodemailer from 'nodemailer';

// Импортируем роутеры
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import appointmentRoutes from './routes/appointmentRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import documentRoutes from './routes/documentRoutes.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
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
app.use('/api/admin', adminRoutes);
app.use('/api/documents', documentRoutes);
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
app.use('/uploads/documents', express.static(path.join(__dirname, '../uploads/documents')));

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

app.get('/api/test-email', async (req, res) => {
    try {
        console.log('📧 Тестовая отправка через Gmail...');
        console.log('EMAIL_USER:', process.env.EMAIL_USER);
        console.log('EMAIL_HOST:', process.env.EMAIL_HOST);
        console.log('EMAIL_PORT:', process.env.EMAIL_PORT);
        
        const testTransporter = nodemailer.createTransport({
            host: process.env.EMAIL_HOST,
            port: parseInt(process.env.EMAIL_PORT),
            secure: false,
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASSWORD
            },
            tls: {
                rejectUnauthorized: false
            }
        });
        
        // Проверяем подключение
        await testTransporter.verify();
        console.log('✅ Подключение к SMTP успешно');
        
        // Отправляем тестовое письмо себе
        const info = await testTransporter.sendMail({
            from: `"АвтоСтрах Тест" <${process.env.EMAIL_USER}>`,
            to: process.env.EMAIL_USER,
            subject: '✅ SMTP работает!',
            text: 'Если вы видите это письмо, настройка Gmail выполнена правильно!',
            html: '<h1>✅ Успех!</h1><p>SMTP Gmail настроен корректно.</p>'
        });
        
        console.log('✅ Письмо отправлено:', info.messageId);
        
        res.json({ 
            success: true, 
            messageId: info.messageId,
            message: 'Письмо отправлено на ' + process.env.EMAIL_USER
        });
        
    } catch (error) {
        console.error('❌ Ошибка теста:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message
        });
    }
});

app.listen(PORT, () => {
  console.log(`✅ Сервер запущен по адресу: http://localhost:${PORT}`);
  connectDB();
});