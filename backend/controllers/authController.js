import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import sql from 'mssql';


const register = async (req, res) => {
    try {
        const { surname, name, patronymic, phoneNumber, regEmail, regPassword } = req.body;

        // Проверки на дубликаты (как в варианте 1)

        const pool = await sql.connect();

        // Проверка email
        const emailCheck = await pool.request()
            .input('regEmail', sql.NVarChar, regEmail)
            .query('SELECT ClientId FROM Client WHERE ClientEmail = @regEmail');

        if (emailCheck.recordset.length > 0) {
            return res.status(409).json({
                success: false,
                error: 'Пользователь с таким email уже существует'
            });
        }

        // Проверка телефона
        const phoneCheck = await pool.request()
            .input('phoneNumber', sql.NVarChar, phoneNumber)
            .query('SELECT ClientId FROM Client WHERE ClientPhoneNumber = @phoneNumber');

        if (phoneCheck.recordset.length > 0) {
            return res.status(409).json({
                success: false,
                error: 'Пользователь с таким номером телефона уже существует'
            });
        }

        // Хешируем пароль
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(regPassword, salt);

        // Сохраняем хеш вместо открытого пароля
        const result = await pool.request()
            .input('surname', sql.NVarChar, surname)
            .input('name', sql.NVarChar, name)
            .input('patronymic', sql.NVarChar, patronymic)
            .input('phoneNumber', sql.NVarChar, phoneNumber)
            .input('regEmail', sql.NVarChar, regEmail)
            .input('regPassword', sql.NVarChar, hashedPassword) // <-- Хеш
            .query(`INSERT INTO Client 
                    (ClientSurname, ClientName, ClientPatronymic, ClientPhoneNumber, ClientEmail, ClientPassword)
                    VALUES (@surname, @name, @patronymic, @phoneNumber, @regEmail, @regPassword)`);

        res.status(201).json({
            success: true,
            message: `Пользователь ${name} ${surname} успешно зарегистрирован`,
        });

    } catch (error) {
        console.error(`❌ Ошибка регистрации: ${error}`);
        res.status(500).json({
            success: false,
            error: 'Внутренняя ошибка сервера'
        });
    }
};

const login = async (req, res) => {
    try {
        console.log('📥 Вход:', req.body);
        const { login, password } = req.body;

        const pool = await sql.connect();

        // Ищем пользователя по email
        const result = await pool.request()
            .input('regEmail', sql.NVarChar, login)
            .query('SELECT * FROM Client WHERE ClientEmail = @regEmail');

        if (result.recordset.length === 0) {
            return res.status(401).json({
                success: false,
                error: 'Неверный email или пароль'
            });
        }

        const user = result.recordset[0];

        // Сравниваем пароль с хешем
        const isPasswordValid = await bcrypt.compare(password, user.ClientPassword);

        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                error: 'Неверный email или пароль'
            });
        }

        // Генерируем JWT токен
        const token = jwt.sign(
            {
                userId: user.ClientId,
                email: user.ClientEmail
            },
            process.env.JWT_SECRET || 'your-secret-key',
            { expiresIn: '7d' }
        );

        // Убираем пароль из ответа
        const { ClientPassword, ...userWithoutPassword } = user;

        res.json({
            success: true,
            message: 'Вход выполнен успешно',
            user: userWithoutPassword,
            token
        });

    } catch (error) {
        console.error(`❌ Ошибка входа:`, error);
        res.status(500).json({
            success: false,
            error: 'Внутренняя ошибка сервера'
        });
    }
};

// ВЫХОД
const logout = (req, res) => {
    res.json({
        success: true,
        message: 'Выход выполнен'
    });
};

const profile = async (req, res) => {
    res.json({ message: 'Регистрация (заглушка)' });
};

const vehicles = async (req, res) => {
    res.json({ message: 'Вход (заглушка)' });
};

const policies = async (req, res) => {
    res.json({ message: 'Выход (заглушка)' });
};

const appointments = async (req, res) => {
    res.json({ message: 'Выход (заглушка)' });
};



export { register, login, logout, profile, vehicles, policies, appointments }