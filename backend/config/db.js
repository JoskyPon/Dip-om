import sql from 'mssql';
import dotenv from 'dotenv';

dotenv.config()

const config = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER,
    database: process.env.DB_NAME,
    options: {
        encrypt: false,
        trustServerCertificate: true,
        enableArithAbort: true,
        connectTimeout: 60000,     // 60 секунд на подключение
        requestTimeout: 60000,      // 60 секунд на запрос
        cancelTimeout: 30000        // 30 секунд на отмену
    },
    connectionTimeout: 60000,
    requestTimeout: 60000,
    pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000
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
