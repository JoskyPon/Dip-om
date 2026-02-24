import sql from 'mssql';
import dotenv from 'dotenv';

dotenv.config()

const config = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER,
    database: process.env.DB_NAME,
    options: {
        trustServerCertificate: true
    }
};


export const connectDB = async () => {
    try {
        const pool = await sql.connect(config);
        console.log('Успешное подключение к SQL Server');
        return pool;
    } catch (err) {
        console.error('Ошибка подключения:', err);
    }
};

// Пример выполнения запроса
export const getData = async () => {
    try {
        const pool = await connectDB();
        const result = await pool.request().query('SELECT TOP 10 * FROM Client');
        console.dir(result.recordset);
        return result.recordset;
    } catch (err) {
        console.error('Ошибка запроса:', err);
    }
};
