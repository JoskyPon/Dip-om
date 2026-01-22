import express from 'express';
import cors from 'cors';
import { connectDB, getData } from './config/db.js';
import dotenv from 'dotenv';

import authRoutes from './routes/authRoutes.js';

dotenv.config()

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());


// Простейший тестовый маршрут
app.get('/api/test', (req, res) => {
  res.json({ 
    message: 'Сервер работает!',
    database: 'SQLite (файловая)',
    status: 'ok'
  });
});

// Маршруты (добавим позже)
 app.use('/api/auth', authRoutes);

app.listen(PORT, () => {
  console.log(`✅ Сервер запущен по адресу: http://localhost:${PORT}`);
  connectDB()
});

  getData()