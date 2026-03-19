import jwt from 'jsonwebtoken';

export const authenticate = async (req, res, next) => {
    try {
        // 1. Получаем токен из заголовка
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                error: 'Токен не предоставлен'
            });
        }

        // 2. Извлекаем токен
        const token = authHeader.split(' ')[1];

        // 3. Проверяем токен
        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET || 'your-secret-key'
        );

        // 4. Добавляем данные пользователя в запрос
        req.user = {
            userId: decoded.userId,
            email: decoded.email
        };

        console.log(`✅ Авторизован пользователь ID: ${req.user.userId}`);

        // 5. Передаём управление дальше
        next();

    } catch (error) {
        console.error('❌ Ошибка аутентификации:', error.message);

        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                success: false,
                error: 'Недействительный токен'
            });
        }

        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                error: 'Токен истёк. Войдите снова'
            });
        }

        res.status(500).json({
            success: false,
            error: 'Ошибка аутентификации'
        });
    }
};