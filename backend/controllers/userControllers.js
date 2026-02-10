import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import sql from 'mssql';


// ПРОСТЕЙШИЙ КОНТРОЛЛЕР - только запись в БД
export const addUser = async (req, res) => {
    try {
        // 1. Получаем данные из запроса
        // req.body содержит данные, которые отправил клиент
        const { dotaname, csname } = req.body;

        console.log('📥 Получена инфа о доте:', dotaname);
        console.log('📥 Получена инфа о cs:', csname);

        // 2. Подключаемся к БД
        const pool = await sql.connect();

        // 3. Выполняем SQL-запрос для вставки данных
        // ВАЖНО: Используем параметризованные запросы для безопасности!
        const result = await pool.request()
            .input('dotaname', sql.NVarChar, dotaname) // Параметр для защиты от SQL-инъекций
            .input('csname', sql.NVarChar, csname)
            .query(`
        INSERT INTO games (dota, cs) 
        VALUES (@dotaname, @csname);
        SELECT SCOPE_IDENTITY() as id;`);

        // 4. Получаем ID новой записи
        const newUserId = result.recordset[0].id;

        console.log('✅ Пользователь добавлен в БД, ID:', newUserId);

        // 5. Отправляем ответ клиенту
        res.json({
            success: true,
            message: `Инфа о доте: "${dotaname}" и о кс: "${csname}" успешно добавлена!`,
            userId: newUserId
        });

    } catch (error) {
        // 6. Обрабатываем ошибки
        console.error('❌ Ошибка при добавлении пользователя:', error);

        res.status(500).json({
            success: false,
            error: 'Ошибка сервера при добавлении пользователя'
        });
    }
};

// Контроллер для получения всех пользователей (для проверки)
export const getUsers = async (req, res) => {
    try {
        const pool = await sql.connect();
        const result = await pool.request()
            .query('SELECT * FROM games');

        res.json({
            success: true,
            users: result.recordset
        });
    } catch (error) {
        console.error('❌ Ошибка при получении пользователей:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка сервера'
        });
    }
};