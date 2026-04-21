import sql from 'mssql';
import { connectDB } from '../config/db.js';

// Функция для проверки доступности времени записи
async function isTimeSlotAvailable(pool, appointmentDateTime) {
    const checkTime = await pool.request()
        .input('appointmentDateTime', sql.DateTime, appointmentDateTime)
        .query(`
            SELECT COUNT(*) as count 
            FROM ApplicationForRegistration 
            WHERE ApplicationDate = @appointmentDateTime 
            AND Status != 'Отменено'
        `);

    return checkTime.recordset[0].count === 0;
}

async function checkLastAppointment(pool, clientId, newAppointmentDate) {
    const result = await pool.request()
        .input('clientId', sql.Int, clientId)
        .query(`
            SELECT TOP 1 ApplicationDate
            FROM ApplicationForRegistration
            WHERE ClientId = @clientId
            AND Status != 'Отменено'
            AND ApplicationDate <= GETDATE() + 30  -- Проверяем записи на ближайшие 30 дней
            ORDER BY ApplicationDate DESC
        `);

    if (result.recordset.length === 0) {
        return true; // Нет предыдущих записей
    }

    const lastAppointment = new Date(result.recordset[0].ApplicationDate);
    const newAppointment = new Date(newAppointmentDate);

    // Разница в часах
    const hoursDiff = (newAppointment - lastAppointment) / (1000 * 60 * 60);

    if (hoursDiff < 24) {
        return false; // Меньше 24 часов
    }

    return true; // Прошло больше 24 часов
}

// Функция для поиска или создания категорий прав
async function findOrCreateCategories(pool, selectedCategories) {
    // Проверяем, существуют ли уже такие категории
    const categoriesCheck = await pool.request()
        .query(`
            SELECT TOP 1 CategoriesId, KategoryA, KategoryB, KategoryC, KategoryD, KategoryM 
            FROM Categories 
            WHERE KategoryA = ${selectedCategories.includes('A') ? 1 : 0}
            AND KategoryB = ${selectedCategories.includes('B') ? 1 : 0}
            AND KategoryC = ${selectedCategories.includes('C') ? 1 : 0}
            AND KategoryD = ${selectedCategories.includes('D') ? 1 : 0}
            AND KategoryM = ${selectedCategories.includes('M') ? 1 : 0}
        `);

    if (categoriesCheck.recordset.length > 0) {
        return categoriesCheck.recordset[0].CategoriesId;
    }

    // Создаём новую запись категорий
    const result = await pool.request()
        .input('kategoryA', sql.Bit, selectedCategories.includes('A') ? 1 : 0)
        .input('kategoryB', sql.Bit, selectedCategories.includes('B') ? 1 : 0)
        .input('kategoryC', sql.Bit, selectedCategories.includes('C') ? 1 : 0)
        .input('kategoryD', sql.Bit, selectedCategories.includes('D') ? 1 : 0)
        .input('kategoryM', sql.Bit, selectedCategories.includes('M') ? 1 : 0)
        .query(`
            INSERT INTO Categories (KategoryA, KategoryB, KategoryC, KategoryD, KategoryM)
            OUTPUT INSERTED.CategoriesId
            VALUES (@kategoryA, @kategoryB, @kategoryC, @kategoryD, @kategoryM)
        `);

    return result.recordset[0].CategoriesId;
}

// Основной контроллер для записи на приём
export const createAppointment = async (req, res) => {
    console.log('📥 ПОЛУЧЕН POST ЗАПРОС /api/appointments');
    console.log('📥 req.body:', req.body);
    console.log('📥 req.user:', req.user);

    try {
        const {
            passport,
            passportDate,
            passportIssuedBy,
            driverLicense,
            driverLicenseDate,
            driverLicenseCategories,
            carRegistrationNumber,
            carVIN,
            carBrand,
            carModel,
            carDate,
            carSTS,
            carPower,
            dateOfVisit,
            appointmentPolicy
        } = req.body;

        const clientId = req.user?.userId;

        if (!clientId) {
            return res.status(401).json({
                success: false,
                error: 'Необходима авторизация для записи на приём'
            });
        }

        const pool = await connectDB();

        // УПРОЩЁННО: Сначала сохраняем автомобиль (если его нет)
        const existingVehicle = await pool.request()
            .input('carRegistrationNumber', sql.NVarChar, carRegistrationNumber)
            .query('SELECT RegistrationNumber FROM Vehicle WHERE RegistrationNumber = @carRegistrationNumber');

        if (existingVehicle.recordset.length === 0) {
            await pool.request()
                .input('carRegistrationNumber', sql.NVarChar, carRegistrationNumber)
                .input('carVIN', sql.NVarChar, carVIN)
                .input('carBrand', sql.NVarChar, carBrand)
                .input('carModel', sql.NVarChar, carModel)
                .input('carDate', sql.Int, parseInt(carDate))
                .input('carSTS', sql.NVarChar, carSTS)
                .input('enginePower', sql.Int, carPower || 100)
                .query(`
                    INSERT INTO Vehicle (
                        RegistrationNumber, VINNumber, VehicleBrand, VehicleModel, 
                        YearOfRelease, EnginePower, VehicleRegistrationCertificateNumber
                    )
                    VALUES (
                        @carRegistrationNumber, @carVIN, @carBrand, @carModel,
                        @carDate, @enginePower, @carSTS
                    )
                `);
            console.log('✅ Автомобиль добавлен');
        }

        // Обновляем данные клиента
        await pool.request()
            .input('clientId', sql.Int, clientId)
            .input('carRegistrationNumber', sql.NVarChar, carRegistrationNumber)
            .query(`
                UPDATE Client 
                SET RegistrationNumber = @carRegistrationNumber
                WHERE ClientId = @clientId
            `);

        // Находим сотрудника
        const employeeResult = await pool.request()
            .input('postId', sql.Int, 2)
            .query(`
                SELECT TOP 1 EmployeeId 
                FROM Employee 
                WHERE Post = @postId
            `);

        const employeeId = employeeResult.recordset[0]?.EmployeeId || 1;

        // Создаём заявку
        const applicationResult = await pool.request()
            .input('clientId', sql.Int, clientId)
            .input('employeeId', sql.Int, employeeId)
            .input('carRegistrationNumber', sql.NVarChar, carRegistrationNumber)
            .input('productId', sql.Int, appointmentPolicy || 1)
            .input('appointmentDate', sql.DateTime, new Date(dateOfVisit))
            .input('status', sql.NVarChar, 'Ожидание')
            .query(`
                INSERT INTO ApplicationForRegistration (
                    ClientId, EmployeeId, RegistrationNumber, ProductId, 
                    ApplicationDate, Status
                )
                OUTPUT INSERTED.ApplicationId
                VALUES (
                    @clientId, @employeeId, @carRegistrationNumber, @productId,
                    @appointmentDate, @status
                )
            `);

        const applicationId = applicationResult.recordset[0].ApplicationId;
        console.log(`✅ Заявка ${applicationId} создана`);

        res.status(201).json({
            success: true,
            message: 'Запись на приём успешно создана',
            applicationId: applicationId,
            appointmentDate: dateOfVisit,
            status: 'Ожидание'
        });

    } catch (error) {
        console.error('❌ Ошибка создания записи на приём:', error);
        res.status(500).json({
            success: false,
            error: 'Внутренняя ошибка сервера при создании записи: ' + error.message
        });
    }
};

// Контроллер для проверки доступного времени
export const checkAvailableTime = async (req, res) => {
    try {
        const { date } = req.query;

        if (!date) {
            return res.status(400).json({
                success: false,
                error: 'Не указана дата для проверки'
            });
        }

        if (checkLastAppointment()) {
        } else {
            res.status(500).json({
            success: false,
            error: 'Есть запись в ближайшие 24 часа'
        });
        }
        

        // ПРОВЕРКА НА ВЫХОДНОЙ ДЕНЬ
        const selectedDate = new Date(date);
        const dayOfWeek = selectedDate.getDay(); // 0 - воскресенье, 6 - суббота

        if (dayOfWeek === 0 || dayOfWeek === 6) {
            return res.json({
                success: true,
                date: date,
                availableTimes: [],
                busyTimes: [],
                isWeekend: true,
                message: 'Выбран выходной день. Приём осуществляется только в будние дни (пн-пт).',
                allSlots: 0,
                availableCount: 0
            });
        }

        const pool = await connectDB();

        // Получаем все занятые слоты на указанную дату
        const result = await pool.request()
            .input('date', sql.Date, new Date(date))
            .query(`
                SELECT CONVERT(VARCHAR(5), ApplicationDate, 108) as time
                FROM ApplicationForRegistration 
                WHERE CAST(ApplicationDate AS DATE) = @date
                AND Status != 'Отменено'
            `);

        // Массив занятого времени
        const busyTimes = result.recordset.map(r => r.time);

        // Генерируем все возможные слоты с 9:00 до 18:00 с шагом 15 минут
        const allTimes = [];
        for (let hour = 9; hour < 18; hour++) {
            for (let minute = 0; minute < 60; minute += 15) {
                const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
                allTimes.push(timeString);
            }
        }

        // Фильтруем доступное время (исключаем занятое)
        let availableTimes = allTimes.filter(time => !busyTimes.includes(time + ':00'));

        // Проверка на сегодняшнюю дату
        const today = new Date();
        const isToday = selectedDate.toDateString() === today.toDateString();

        if (isToday) {
            // Текущее время с округлением до следующей 15-минутки
            const currentHour = today.getHours();
            const currentMinute = today.getMinutes();
            const nextSlotMinute = Math.ceil(currentMinute / 15) * 15;

            // Оставляем только будущие слоты
            availableTimes = availableTimes.filter(time => {
                const [hour, minute] = time.split(':').map(Number);
                if (hour > currentHour) return true;
                if (hour === currentHour && minute >= nextSlotMinute) return true;
                return false;
            });
        }

        res.json({
            success: true,
            date: date,
            availableTimes: availableTimes,
            busyTimes: busyTimes,
            isWeekend: false,
            allSlots: allTimes.length,
            availableCount: availableTimes.length
        });

    } catch (error) {
        console.error('❌ Ошибка проверки времени:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка при проверке доступного времени'
        });
    }
};

// Получить записи текущего пользователя
export const getUserAppointments = async (req, res) => {
    try {
        const userId = req.user.userId;

        const pool = await connectDB();
        const result = await pool.request()
            .input('userId', sql.Int, userId)
            .query(`
                SELECT 
                    a.ApplicationId,
                    a.ApplicationDate,
                    a.Status,
                    v.VehicleBrand,
                    v.VehicleModel,
                    v.RegistrationNumber,
                    p.ProductName,
                    p.ProductType
                FROM ApplicationForRegistration a
                JOIN Vehicle v ON a.RegistrationNumber = v.RegistrationNumber
                JOIN InsuranceProduct p ON a.ProductId = p.ProductId
                WHERE a.ClientId = @userId
                ORDER BY a.ApplicationDate DESC
            `);

        res.json({
            success: true,
            appointments: result.recordset
        });

    } catch (error) {
        console.error('❌ Ошибка получения записей:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка при получении записей'
        });
    }
};