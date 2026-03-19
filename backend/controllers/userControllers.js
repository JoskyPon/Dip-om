import sql from 'mssql';
import { connectDB } from '../config/db.js';

export const getUserDashboard = async (req, res) => {
    try {
        const userId = req.user.userId;
        console.log(`📊 Запрос данных для пользователя ID: ${userId}`);

        const pool = await connectDB();

        // 1. Получаем данные пользователя
        const userResult = await pool.request()
            .input('userId', sql.Int, userId)
            .query(`
                SELECT 
                    ClientId,
                    ClientSurname,
                    ClientName,
                    ClientPatronymic,
                    ClientPhoneNumber,
                    ClientEmail
                FROM Client 
                WHERE ClientId = @userId
            `);

        if (userResult.recordset.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Пользователь не найден'
            });
        }

        const user = userResult.recordset[0];

        // 2. Получаем автомобили пользователя со связанными полисами
        const vehiclesResult = await pool.request()
            .input('userId', sql.Int, userId)
            .query(`
                SELECT 
                    v.RegistrationNumber,
                    v.VINNumber,
                    v.VehicleBrand,
                    v.VehicleModel,
                    v.YearOfRelease,
                    v.EnginePower,
                    v.VehicleRegistrationCertificateNumber as STSNumber,
                    ip.PolicyNumber,
                    ip.StartDate,
                    ip.EndDate,
                    ip.PolicyStatus,
                    ip.PolicyCost,
                    ip.DateOfRegistration,
                    pr.ProductName,
                    pr.ProductType
                FROM Vehicle v
                LEFT JOIN ApplicationForRegistration afr ON v.RegistrationNumber = afr.RegistrationNumber
                LEFT JOIN InsurancePolicy ip ON afr.ApplicationId = ip.ApplicationId
                LEFT JOIN InsuranceProduct pr ON afr.ProductId = pr.ProductId
                WHERE v.RegistrationNumber IN (
                    SELECT RegistrationNumber 
                    FROM Client 
                    WHERE ClientId = @userId
                )
                ORDER BY ip.StartDate DESC
            `);

        // Группируем автомобили и их полисы
        const vehicles = {};

        vehiclesResult.recordset.forEach(row => {
            const regNumber = row.RegistrationNumber;

            if (!vehicles[regNumber]) {
                vehicles[regNumber] = {
                    registrationNumber: row.RegistrationNumber,
                    vinNumber: row.VINNumber,
                    brand: row.VehicleBrand,
                    model: row.VehicleModel,
                    year: row.YearOfRelease,
                    enginePower: row.EnginePower,
                    stsNumber: row.STSNumber,
                    policies: []
                };
            }

            if (row.PolicyNumber) {
                vehicles[regNumber].policies.push({
                    policyNumber: row.PolicyNumber,
                    startDate: row.StartDate,
                    endDate: row.EndDate,
                    status: row.PolicyStatus,
                    cost: row.PolicyCost,
                    registrationDate: row.DateOfRegistration,
                    productName: row.ProductName,
                    productType: row.ProductType
                });
            }
        });

        // 3. Получаем ближайшие записи на приём
        const appointmentsResult = await pool.request()
            .input('userId', sql.Int, userId)
            .query(`
                SELECT TOP 5
                    afr.ApplicationId,
                    afr.ApplicationDate,
                    afr.Status,
                    v.VehicleBrand,
                    v.VehicleModel,
                    v.RegistrationNumber,
                    pr.ProductName
                FROM ApplicationForRegistration afr
                JOIN Vehicle v ON afr.RegistrationNumber = v.RegistrationNumber
                JOIN InsuranceProduct pr ON afr.ProductId = pr.ProductId
                WHERE afr.ClientId = @userId
                AND afr.ApplicationDate >= GETDATE()
                ORDER BY afr.ApplicationDate ASC
            `);

        res.json({
            success: true,
            user: {
                id: user.ClientId,
                surname: user.ClientSurname,
                name: user.ClientName,
                patronymic: user.ClientPatronymic,
                phone: user.ClientPhoneNumber,
                email: user.ClientEmail,
                fullName: `${user.ClientSurname} ${user.ClientName} ${user.ClientPatronymic || ''}`.trim()
            },
            vehicles: Object.values(vehicles),
            upcomingAppointments: appointmentsResult.recordset
        });

    } catch (error) {
        console.error('❌ Ошибка получения данных кабинета:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка при загрузке данных личного кабинета'
        });
    }
};

// Получить конкретный автомобиль с историей полисов
export const getVehicleDetails = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { registrationNumber } = req.params;

        const pool = await connectDB();

        const result = await pool.request()
            .input('userId', sql.Int, userId)
            .input('regNumber', sql.NVarChar, registrationNumber)
            .query(`
                SELECT 
                    v.*,
                    ip.PolicyNumber,
                    ip.StartDate,
                    ip.EndDate,
                    ip.PolicyStatus,
                    ip.PolicyCost,
                    ip.DateOfRegistration,
                    pr.ProductName,
                    pr.ProductType,
                    p.PaymentAmount,
                    p.PaymentDate,
                    p.PaymentStatus
                FROM Vehicle v
                LEFT JOIN ApplicationForRegistration afr ON v.RegistrationNumber = afr.RegistrationNumber
                LEFT JOIN InsurancePolicy ip ON afr.ApplicationId = ip.ApplicationId
                LEFT JOIN InsuranceProduct pr ON afr.ProductId = pr.ProductId
                LEFT JOIN Payment p ON ip.PaymentId = p.PaymentId
                WHERE v.RegistrationNumber = @regNumber
                AND v.RegistrationNumber IN (
                    SELECT RegistrationNumber 
                    FROM Client 
                    WHERE ClientId = @userId
                )
                ORDER BY ip.StartDate DESC
            `);

        if (result.recordset.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Автомобиль не найден'
            });
        }

        const vehicle = {
            ...result.recordset[0],
            policies: result.recordset.map(row => ({
                policyNumber: row.PolicyNumber,
                startDate: row.StartDate,
                endDate: row.EndDate,
                status: row.PolicyStatus,
                cost: row.PolicyCost,
                productName: row.ProductName,
                productType: row.ProductType,
                payment: row.PaymentAmount ? {
                    amount: row.PaymentAmount,
                    date: row.PaymentDate,
                    status: row.PaymentStatus
                } : null
            })).filter(p => p.policyNumber) // Убираем null записи
        };

        res.json({
            success: true,
            vehicle
        });

    } catch (error) {
        console.error('❌ Ошибка получения данных автомобиля:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка при загрузке данных автомобиля'
        });
    }
};