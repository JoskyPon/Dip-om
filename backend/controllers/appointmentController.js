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
    // Начинаем транзакцию
    const transaction = new sql.Transaction();

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

        // Получаем ID текущего пользователя из токена (должен быть добавлен middleware)
        const clientId = req.user?.userId;

        if (!clientId) {
            return res.status(401).json({
                success: false,
                error: 'Необходима авторизация для записи на приём'
            });
        }

        const pool = await connectDB();

        // Начинаем транзакцию
        await transaction.begin();

        const appointmentDate = new Date(dateOfVisit);
        const dayOfWeek = appointmentDate.getDay();

        if (dayOfWeek === 0 || dayOfWeek === 6) {
            return res.status(400).json({
                success: false,
                error: 'Запись на приём возможна только в будние дни (пн-пт)'
            });
        }

        // Проверяем доступность времени
        const isAvailable = await isTimeSlotAvailable(pool, new Date(dateOfVisit));
        if (!isAvailable) {
            await transaction.rollback();
            return res.status(409).json({
                success: false,
                error: 'Выбранное время уже занято. Пожалуйста, выберите другое время.'
            });
        }

        const canCreate = await checkLastAppointment(pool, clientId, dateOfVisit);
        if (!canCreate) {
            await transaction.rollback();
            return res.status(409).json({
                success: false,
                error: 'Вы можете записаться на следующий приём не раньше, чем через 24 часа после предыдущего'
            });
        }

        // 1. РАБОТА С ПАСПОРТНЫМИ ДАННЫМИ
        let passportId = passport;

        // Проверяем, существует ли паспорт
        const existingPassport = await pool.request()
            .input('passport', sql.Int, passport)
            .query('SELECT SeriesAndNumberOfPassport FROM Passport WHERE SeriesAndNumberOfPassport = @passport');

        if (existingPassport.recordset.length === 0) {
            // Создаём новый паспорт
            await transaction.request()
                .input('passport', sql.Int, passport)
                .input('passportDate', sql.Date, passportDate)
                .input('passportIssuedBy', sql.NVarChar, passportIssuedBy)
                .query(`
                    INSERT INTO Passport (SeriesAndNumberOfPassport, DateOfIssue, IssuedBy)
                    VALUES (@passport, @passportDate, @passportIssuedBy)
                `);
        }

        // 2. РАБОТА С КАТЕГОРИЯМИ ПРАВ
        const categoriesId = await findOrCreateCategories(pool, driverLicenseCategories);

        // 3. РАБОТА С ВОДИТЕЛЬСКИМ УДОСТОВЕРЕНИЕМ
        const existingLicense = await pool.request()
            .input('driverLicense', sql.Int, driverLicense)
            .query('SELECT DriverLicenseNumber FROM DriverLicense WHERE DriverLicenseNumber = @driverLicense');

        if (existingLicense.recordset.length === 0) {
            // Создаём новое водительское удостоверение
            await transaction.request()
                .input('driverLicense', sql.Int, driverLicense)
                .input('driverLicenseDate', sql.Date, new Date(driverLicenseDate))
                .input('categoriesId', sql.Int, categoriesId)
                .query(`
                    INSERT INTO DriverLicense (DriverLicenseNumber, DateOfIssue, AvailableCategories)
                    VALUES (@driverLicense, @driverLicenseDate, @categoriesId)
                `);
        }

        // 4. РАБОТА С АВТОМОБИЛЕМ
        const existingVehicle = await pool.request()
            .input('carRegistrationNumber', sql.NVarChar, carRegistrationNumber)
            .query('SELECT RegistrationNumber FROM Vehicle WHERE RegistrationNumber = @carRegistrationNumber');

        if (existingVehicle.recordset.length === 0) {
            // Проверяем VIN на уникальность
            const existingVIN = await pool.request()
                .input('carVIN', sql.NVarChar, carVIN)
                .query('SELECT VINNumber FROM Vehicle WHERE VINNumber = @carVIN');

            if (existingVIN.recordset.length > 0) {
                await transaction.rollback();
                return res.status(409).json({
                    success: false,
                    error: 'Автомобиль с таким VIN номером уже зарегистрирован в системе'
                });
            }

            // Создаём новый автомобиль
            await transaction.request()
                .input('carRegistrationNumber', sql.NVarChar, carRegistrationNumber)
                .input('carVIN', sql.NVarChar, carVIN)
                .input('carBrand', sql.NVarChar, carBrand)
                .input('carModel', sql.NVarChar, carModel)
                .input('carDate', sql.Int, parseInt(carDate))
                .input('carSTS', sql.NVarChar, carSTS)
                .input('enginePower', sql.Int, carPower)
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
        }

        // 5. ОБНОВЛЯЕМ ДАННЫЕ КЛИЕНТА
        await transaction.request()
            .input('clientId', sql.Int, clientId)
            .input('passport', sql.Int, passport)
            .input('driverLicense', sql.Int, driverLicense)
            .input('carRegistrationNumber', sql.NVarChar, carRegistrationNumber)
            .query(`
                UPDATE Client 
                SET SeriesAndNumberOfPassport = @passport,
                    DriverLicenseNumber = @driverLicense,
                    RegistrationNumber = @carRegistrationNumber
                WHERE ClientId = @clientId
            `);

        // 6. СОЗДАЁМ ЗАЯВКУ НА ПРИЁМ
        // Находим доступного сотрудника
        const employeeResult = await pool.request()
            .input('postId', sql.Int, 2)
            .query(`
        SELECT TOP 1 EmployeeId 
        FROM Employee 
        WHERE Post = @postId
        ORDER BY EmployeeId  -- Сортировка по ID (или другому полю)
    `);

        const employeeId = employeeResult.recordset[0]?.EmployeeId || 1;

        // Создаём заявку
        const applicationResult = await transaction.request()
            .input('clientId', sql.Int, clientId)
            .input('employeeId', sql.Int, employeeId)
            .input('carRegistrationNumber', sql.NVarChar, carRegistrationNumber)
            .input('productId', sql.Int, appointmentPolicy)
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

        // Подтверждаем транзакцию
        await transaction.commit();

        // Успешный ответ
        res.status(201).json({
            success: true,
            message: 'Запись на приём успешно создана',
            applicationId: applicationId,
            appointmentDate: dateOfVisit,
            status: 'Ожидание'
        });

    } catch (error) {
        // Откатываем транзакцию в случае ошибки
        if (transaction) {
            try {
                await transaction.rollback();
            } catch (rollbackError) {
                console.error('Ошибка при откате транзакции:', rollbackError);
            }
        }

        console.error('❌ Ошибка создания записи на приём:', error);

        // Определяем тип ошибки для понятного ответа
        if (error.number === 2627 || error.number === 2601) {
            // Ошибка уникальности (дубликат)
            return res.status(409).json({
                success: false,
                error: 'Некоторые данные уже существуют в системе. Проверьте уникальность полей.'
            });
        }

        if (error.number === 547) {
            // Ошибка внешнего ключа
            return res.status(400).json({
                success: false,
                error: 'Нарушение целостности данных. Проверьте введённые данные.'
            });
        }

        res.status(500).json({
            success: false,
            error: 'Внутренняя ошибка сервера при создании записи'
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