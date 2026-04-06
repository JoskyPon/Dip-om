// backend/controllers/adminController.js
import sql from 'mssql';
import { connectDB } from '../config/db.js';

// 1. Получить все записи на приём с информацией о клиентах
export const getAllAppointments = async (req, res) => {
    try {
        const { status, startDate, endDate, search } = req.query;

        const pool = await connectDB();

        let query = `
            SELECT 
                afr.ApplicationId,
                afr.ApplicationDate,
                afr.Status,
                afr.ProductId,
                ip.ProductName,
                c.ClientId,
                c.ClientSurname,
                c.ClientName,
                c.ClientPatronymic,
                c.ClientPhoneNumber,
                c.ClientEmail,
                v.RegistrationNumber,
                v.VehicleBrand,
                v.VehicleModel,
                v.VINNumber,
                e.EmployeeId,
                e.EmployeeSurname,
                e.EmployeeName
            FROM ApplicationForRegistration afr
            JOIN Client c ON afr.ClientId = c.ClientId
            LEFT JOIN Vehicle v ON afr.RegistrationNumber = v.RegistrationNumber
            LEFT JOIN InsuranceProduct ip ON afr.ProductId = ip.ProductId
            LEFT JOIN Employee e ON afr.EmployeeId = e.EmployeeId
            WHERE 1=1
        `;

        const request = pool.request();

        // Фильтр по статусу
        if (status && status !== 'all') {
            query += ` AND afr.Status = @status`;
            request.input('status', sql.NVarChar, status);
        }

        // Фильтр по дате
        if (startDate) {
            query += ` AND CAST(afr.ApplicationDate AS DATE) >= @startDate`;
            request.input('startDate', sql.Date, startDate);
        }

        if (endDate) {
            query += ` AND CAST(afr.ApplicationDate AS DATE) <= @endDate`;
            request.input('endDate', sql.Date, endDate);
        }

        // Поиск по ФИО
        if (search) {
            query += ` AND (c.ClientSurname LIKE @search 
                       OR c.ClientName LIKE @search 
                       OR c.ClientPatronymic LIKE @search
                       OR CONCAT(c.ClientSurname, ' ', c.ClientName, ' ', ISNULL(c.ClientPatronymic, '')) LIKE @search)`;
            request.input('search', sql.NVarChar, `%${search}%`);
        }

        query += ` ORDER BY afr.ApplicationDate DESC`;

        const result = await request.query(query);

        // Форматируем данные для ответа
        const appointments = result.recordset.map(row => ({
            applicationId: row.ApplicationId,
            applicationDate: row.ApplicationDate,
            status: row.Status,
            product: {
                id: row.ProductId,
                name: row.ProductName
            },
            client: {
                id: row.ClientId,
                surname: row.ClientSurname,
                name: row.ClientName,
                patronymic: row.ClientPatronymic,
                fullName: `${row.ClientSurname} ${row.ClientName} ${row.ClientPatronymic || ''}`.trim(),
                phone: row.ClientPhoneNumber,
                email: row.ClientEmail
            },
            vehicle: {
                registrationNumber: row.RegistrationNumber,
                brand: row.VehicleBrand,
                model: row.VehicleModel,
                vin: row.VINNumber
            },
            employee: row.EmployeeId ? {
                id: row.EmployeeId,
                surname: row.EmployeeSurname,
                name: row.EmployeeName
            } : null
        }));

        res.json({
            success: true,
            count: appointments.length,
            appointments: appointments
        });

    } catch (error) {
        console.error('❌ Ошибка получения записей:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка при получении списка записей'
        });
    }
};

// 2. Получить детальную информацию о конкретной записи
export const getAppointmentDetails = async (req, res) => {
    try {
        const { id } = req.params;

        const pool = await connectDB();
        const result = await pool.request()
            .input('id', sql.Int, id)
            .query(`
                SELECT 
                    afr.*,
                    c.ClientSurname,
                    c.ClientName,
                    c.ClientPatronymic,
                    c.ClientPhoneNumber,
                    c.ClientEmail,
                    v.RegistrationNumber,
                    v.VINNumber,
                    v.VehicleBrand,
                    v.VehicleModel,
                    v.YearOfRelease,
                    v.EnginePower,
                    ip.ProductName,
                    ip.ProductType,
                    ip.BasicCost,
                    e.EmployeeSurname,
                    e.EmployeeName,
                    e.EmployeePatronymic
                FROM ApplicationForRegistration afr
                JOIN Client c ON afr.ClientId = c.ClientId
                LEFT JOIN Vehicle v ON afr.RegistrationNumber = v.RegistrationNumber
                LEFT JOIN InsuranceProduct ip ON afr.ProductId = ip.ProductId
                LEFT JOIN Employee e ON afr.EmployeeId = e.EmployeeId
                WHERE afr.ApplicationId = @id
            `);

        if (result.recordset.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Запись не найдена'
            });
        }

        const row = result.recordset[0];

        res.json({
            success: true,
            appointment: {
                applicationId: row.ApplicationId,
                applicationDate: row.ApplicationDate,
                status: row.Status,
                client: {
                    id: row.ClientId,
                    surname: row.ClientSurname,
                    name: row.ClientName,
                    patronymic: row.ClientPatronymic,
                    fullName: `${row.ClientSurname} ${row.ClientName} ${row.ClientPatronymic || ''}`.trim(),
                    phone: row.ClientPhoneNumber,
                    email: row.ClientEmail
                },
                vehicle: row.RegistrationNumber ? {
                    registrationNumber: row.RegistrationNumber,
                    vin: row.VINNumber,
                    brand: row.VehicleBrand,
                    model: row.VehicleModel,
                    year: row.YearOfRelease,
                    enginePower: row.EnginePower
                } : null,
                product: row.ProductId ? {
                    id: row.ProductId,
                    name: row.ProductName,
                    type: row.ProductType,
                    basicCost: row.BasicCost
                } : null,
                employee: row.EmployeeId ? {
                    id: row.EmployeeId,
                    surname: row.EmployeeSurname,
                    name: row.EmployeeName,
                    patronymic: row.EmployeePatronymic
                } : null
            }
        });

    } catch (error) {
        console.error('❌ Ошибка получения деталей записи:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка при получении деталей записи'
        });
    }
};

// 3. Поиск пользователей по ФИО
export const searchUsers = async (req, res) => {
    try {
        const { query } = req.query;

        if (!query || query.trim() === '') {
            return res.status(400).json({
                success: false,
                error: 'Введите поисковый запрос'
            });
        }

        const pool = await connectDB();

        // Разбиваем запрос на слова для более точного поиска
        const searchTerms = query.trim().split(/\s+/);

        let sqlQuery = `
            SELECT 
                ClientId,
                ClientSurname,
                ClientName,
                ClientPatronymic,
                ClientPhoneNumber,
                ClientEmail,
                RegistrationNumber,
                Role,
                CreatedAt
            FROM Client
            WHERE 1=1
        `;

        const request = pool.request();

        // Добавляем условия для каждого слова
        searchTerms.forEach((term, index) => {
            const paramName = `term${index}`;
            sqlQuery += ` AND (ClientSurname LIKE @${paramName} 
                           OR ClientName LIKE @${paramName} 
                           OR ClientPatronymic LIKE @${paramName}
                           OR CONCAT(ClientSurname, ' ', ClientName, ' ', ISNULL(ClientPatronymic, '')) LIKE @${paramName})`;
            request.input(paramName, sql.NVarChar, `%${term}%`);
        });

        sqlQuery += ` ORDER BY ClientSurname, ClientName`;

        const result = await request.query(sqlQuery);

        const users = result.recordset.map(user => ({
            id: user.ClientId,
            surname: user.ClientSurname,
            name: user.ClientName,
            patronymic: user.ClientPatronymic,
            fullName: `${user.ClientSurname} ${user.ClientName} ${user.ClientPatronymic || ''}`.trim(),
            phone: user.ClientPhoneNumber,
            email: user.ClientEmail,
            registrationNumber: user.RegistrationNumber,
            role: user.Role || 'user',
            createdAt: user.CreatedAt
        }));

        res.json({
            success: true,
            count: users.length,
            users: users
        });

    } catch (error) {
        console.error('❌ Ошибка поиска пользователей:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка при поиске пользователей'
        });
    }
};

// 4. Обновить статус записи
export const updateAppointmentStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        const validStatuses = ['Ожидание', 'Завершено', 'Отменено'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                error: 'Некорректный статус. Допустимые значения: Ожидание, Завершено, Отменено'
            });
        }

        const pool = await connectDB();

        // Получаем текущую запись для логирования
        const currentAppointment = await pool.request()
            .input('id', sql.Int, id)
            .query('SELECT Status FROM ApplicationForRegistration WHERE ApplicationId = @id');

        if (currentAppointment.recordset.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Запись не найдена'
            });
        }

        const oldStatus = currentAppointment.recordset[0].Status;

        // Обновляем статус
        const result = await pool.request()
            .input('id', sql.Int, id)
            .input('status', sql.NVarChar, status)
            .query(`
                UPDATE ApplicationForRegistration 
                SET Status = @status
                WHERE ApplicationId = @id
            `);

        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({
                success: false,
                error: 'Запись не найдена'
            });
        }

        console.log(`✅ Статус записи ${id} изменён с "${oldStatus}" на "${status}"`);

        res.json({
            success: true,
            message: `Статус записи изменён на "${status}"`,
            oldStatus: oldStatus,
            newStatus: status
        });

    } catch (error) {
        console.error('❌ Ошибка обновления статуса:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка при обновлении статуса'
        });
    }
};

// 5. Получить статистику по записям
export const getAppointmentStats = async (req, res) => {
    try {
        const pool = await connectDB();

        const result = await pool.request().query(`
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN Status = 'Ожидание' THEN 1 ELSE 0 END) as pending,
                SUM(CASE WHEN Status = 'Завершено' THEN 1 ELSE 0 END) as completed,
                SUM(CASE WHEN Status = 'Отменено' THEN 1 ELSE 0 END) as cancelled,
                SUM(CASE WHEN CAST(ApplicationDate AS DATE) = CAST(GETDATE() AS DATE) THEN 1 ELSE 0 END) as today,
                SUM(CASE WHEN CAST(ApplicationDate AS DATE) > CAST(GETDATE() AS DATE) THEN 1 ELSE 0 END) as upcoming,
                SUM(CASE WHEN CAST(ApplicationDate AS DATE) < CAST(GETDATE() AS DATE) THEN 1 ELSE 0 END) as past
            FROM ApplicationForRegistration
        `);

        // Статистика по месяцам для графика
        const monthlyStats = await pool.request().query(`
            SELECT 
                FORMAT(ApplicationDate, 'yyyy-MM') as month,
                COUNT(*) as count,
                SUM(CASE WHEN Status = 'Завершено' THEN 1 ELSE 0 END) as completed
            FROM ApplicationForRegistration
            WHERE ApplicationDate >= DATEADD(month, -6, GETDATE())
            GROUP BY FORMAT(ApplicationDate, 'yyyy-MM')
            ORDER BY month DESC
        `);

        res.json({
            success: true,
            stats: result.recordset[0],
            monthlyStats: monthlyStats.recordset
        });

    } catch (error) {
        console.error('❌ Ошибка получения статистики:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка при получении статистики'
        });
    }
};