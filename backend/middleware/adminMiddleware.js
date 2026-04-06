import sql from 'mssql';
import { connectDB } from '../config/db.js';

export const isAdmin = async (req, res, next) => {
    try {
        const userId = req.user.userId;
        
        const pool = await connectDB();
        const result = await pool.request()
            .input('userId', sql.Int, userId)
            .query('SELECT Role FROM Client WHERE ClientId = @userId');
        
        if (result.recordset.length === 0) {
            return res.status(403).json({
                success: false,
                error: 'Доступ запрещён'
            });
        }
        
        const userRole = result.recordset[0].Role;
        
        if (userRole !== 'admin') {
            return res.status(403).json({
                success: false,
                error: 'Недостаточно прав. Требуются права администратора.'
            });
        }
        
        next();
        
    } catch (error) {
        console.error('❌ Ошибка проверки прав администратора:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка проверки прав доступа'
        });
    }
};