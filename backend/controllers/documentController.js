// backend/controllers/documentController.js
import sql from 'mssql';
import { connectDB } from '../config/db.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { sendPolicyEmail } from './emailController.js';
import nodemailer from 'nodemailer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Загрузка документов пользователем
export const uploadUserDocuments = async (req, res) => {
    try {
        const userId = req.user.userId;

        console.log('📥 Получен запрос на загрузку документов');
        console.log('User ID:', userId);
        console.log('Files:', req.files ? Object.keys(req.files) : 'нет файлов');
        console.log('Body:', req.body);

        // Проверяем наличие файлов
        if (!req.files || !req.files.passportPhoto || !req.files.driverLicensePhoto || !req.files.stsPhoto) {
            return res.status(400).json({
                success: false,
                error: 'Необходимо загрузить все три фотографии: паспорт, ВУ, СТС'
            });
        }

        // Получаем данные из формы
        const {
            passport, passportDate, passportIssuedBy,
            driverLicense, driverLicenseDate, driverLicenseCategories,
            carRegistrationNumber, carVIN, carBrand, carModel,
            carDate, carSTS, carPower, appointmentPolicy
        } = req.body;

        // Проверяем обязательные поля
        if (!passport || !passportDate || !carRegistrationNumber || !carVIN) {
            return res.status(400).json({
                success: false,
                error: 'Заполните все обязательные поля'
            });
        }

        const pool = await connectDB();

        // ========== 1. СНАЧАЛА СОЗДАЁМ АВТОМОБИЛЬ (если его нет) ==========
        console.log('🚗 Проверка существования автомобиля:', carRegistrationNumber);

        const existingVehicle = await pool.request()
            .input('regNumber', sql.NVarChar, carRegistrationNumber)
            .query('SELECT RegistrationNumber FROM Vehicle WHERE RegistrationNumber = @regNumber');

        if (existingVehicle.recordset.length === 0) {
            console.log('🚗 Автомобиль не найден, создаём новый...');

            await pool.request()
                .input('regNumber', sql.NVarChar, carRegistrationNumber)
                .input('vin', sql.NVarChar, carVIN)
                .input('brand', sql.NVarChar, carBrand)
                .input('model', sql.NVarChar, carModel)
                .input('year', sql.Int, parseInt(carDate) || 2000)
                .input('sts', sql.NVarChar, carSTS)
                .input('enginePower', sql.Int, parseInt(carPower) || 100)
                .query(`
                    INSERT INTO Vehicle 
                        (RegistrationNumber, VINNumber, VehicleBrand, VehicleModel, 
                         YearOfRelease, EnginePower, VehicleRegistrationCertificateNumber)
                    VALUES (@regNumber, @vin, @brand, @model, @year, @enginePower, @sts)
                `);
            console.log('✅ Автомобиль добавлен');
        } else {
            console.log('✅ Автомобиль уже существует');
        }

        // ========== 2. ОБНОВЛЯЕМ ДАННЫЕ КЛИЕНТА (номер автомобиля) ==========
        console.log('👤 Обновление данных клиента...');

        await pool.request()
            .input('clientId', sql.Int, userId)
            .input('regNumber', sql.NVarChar, carRegistrationNumber)
            .query(`
                UPDATE Client 
                SET RegistrationNumber = @regNumber
                WHERE ClientId = @clientId
            `);
        console.log('✅ Данные клиента обновлены');

        // ========== 3. СОЗДАЁМ ЗАЯВКУ ==========
        console.log('📝 Создание заявки...');

        const applicationResult = await pool.request()
            .input('clientId', sql.Int, userId)
            .input('employeeId', sql.Int, 11)
            .input('productId', sql.Int, parseInt(appointmentPolicy) || 1)
            .input('registrationNumber', sql.NVarChar, carRegistrationNumber)
            .input('status', sql.NVarChar, 'Ожидание документов')
            .query(`
                INSERT INTO ApplicationForRegistration 
                    (ClientId, EmployeeId, ProductId, RegistrationNumber, Status, ApplicationDate)
                OUTPUT INSERTED.ApplicationId
                VALUES (@clientId, @employeeId, @productId, @registrationNumber, @status, GETDATE())
            `);

        const applicationId = applicationResult.recordset[0].ApplicationId;
        console.log('✅ Заявка создана, ID:', applicationId);

        // ========== 4. СОХРАНЯЕМ ДОКУМЕНТЫ ==========
        const documents = {};

        // Паспорт
        const passportFile = req.files.passportPhoto[0];
        const passportDocResult = await pool.request()
            .input('clientId', sql.Int, userId)
            .input('docType', sql.NVarChar, 'passport')
            .input('docPath', sql.NVarChar, `/uploads/documents/${passportFile.filename}`)
            .input('originalName', sql.NVarChar, passportFile.originalname)
            .query(`
                INSERT INTO UserDocuments 
                    (ClientId, DocumentType, DocumentPath, OriginalFileName, UploadedAt, IsVerified)
                OUTPUT INSERTED.DocumentId
                VALUES (@clientId, @docType, @docPath, @originalName, GETDATE(), 0)
            `);
        documents.passportId = passportDocResult.recordset[0].DocumentId;

        // Водительское удостоверение
        const licenseFile = req.files.driverLicensePhoto[0];
        const licenseDocResult = await pool.request()
            .input('clientId', sql.Int, userId)
            .input('docType', sql.NVarChar, 'driver_license')
            .input('docPath', sql.NVarChar, `/uploads/documents/${licenseFile.filename}`)
            .input('originalName', sql.NVarChar, licenseFile.originalname)
            .query(`
                INSERT INTO UserDocuments 
                    (ClientId, DocumentType, DocumentPath, OriginalFileName, UploadedAt, IsVerified)
                OUTPUT INSERTED.DocumentId
                VALUES (@clientId, @docType, @docPath, @originalName, GETDATE(), 0)
            `);
        documents.licenseId = licenseDocResult.recordset[0].DocumentId;

        // СТС
        const stsFile = req.files.stsPhoto[0];
        const stsDocResult = await pool.request()
            .input('clientId', sql.Int, userId)
            .input('docType', sql.NVarChar, 'sts')
            .input('docPath', sql.NVarChar, `/uploads/documents/${stsFile.filename}`)
            .input('originalName', sql.NVarChar, stsFile.originalname)
            .query(`
                INSERT INTO UserDocuments 
                    (ClientId, DocumentType, DocumentPath, OriginalFileName, UploadedAt, IsVerified)
                OUTPUT INSERTED.DocumentId
                VALUES (@clientId, @docType, @docPath, @originalName, GETDATE(), 0)
            `);
        documents.stsId = stsDocResult.recordset[0].DocumentId;

        // ========== 5. СВЯЗЫВАЕМ ДОКУМЕНТЫ С ЗАЯВКОЙ ==========
        await pool.request()
            .input('appId', sql.Int, applicationId)
            .input('passportDocId', sql.Int, documents.passportId)
            .input('licenseDocId', sql.Int, documents.licenseId)
            .input('stsDocId', sql.Int, documents.stsId)
            .query(`
                UPDATE ApplicationForRegistration 
                SET PassportDocumentId = @passportDocId,
                    DriverLicenseDocumentId = @licenseDocId,
                    StsDocumentId = @stsDocId
                WHERE ApplicationId = @appId
            `);

        console.log('✅ Документы сохранены и привязаны к заявке');

        // ========== 6. СОХРАНЯЕМ ПАСПОРТНЫЕ ДАННЫЕ ==========
        try {
            // Очищаем номер паспорта от нецифровых символов
            const cleanPassport = passport ? parseInt(passport.toString().replace(/\D/g, '')) : null;
            console.log('📝 Номер паспорта (очищенный):', cleanPassport);

            if (cleanPassport && !isNaN(cleanPassport) && cleanPassport > 0) {
                const existingPassport = await pool.request()
                    .input('passport', sql.Int, cleanPassport)
                    .query('SELECT SeriesAndNumberOfPassport FROM Passport WHERE SeriesAndNumberOfPassport = @passport');

                if (existingPassport.recordset.length === 0) {
                    await pool.request()
                        .input('passport', sql.Int, cleanPassport)
                        .input('passportDate', sql.Date, passportDate)
                        .input('issuedBy', sql.NVarChar, passportIssuedBy || 'Не указано')
                        .query(`
                            INSERT INTO Passport (SeriesAndNumberOfPassport, DateOfIssue, IssuedBy)
                            VALUES (@passport, @passportDate, @issuedBy)
                        `);
                    console.log('✅ Паспортные данные сохранены');
                } else {
                    console.log('✅ Паспорт уже существует в базе');
                }

                // Обновляем клиента
                await pool.request()
                    .input('clientId', sql.Int, userId)
                    .input('passport', sql.Int, cleanPassport)
                    .query(`
                        UPDATE Client 
                        SET SeriesAndNumberOfPassport = @passport
                        WHERE ClientId = @clientId
                    `);
                console.log('✅ Паспорт привязан к клиенту');
            } else {
                console.warn('⚠️ Номер паспорта пропущен (некорректный формат):', passport);
            }
        } catch (err) {
            console.error('❌ Ошибка при сохранении паспорта:', err.message);
        }

        // ========== 7. СОХРАНЯЕМ КАТЕГОРИИ И ВОДИТЕЛЬСКОЕ УДОСТОВЕРЕНИЕ ==========
        try {
            // Очищаем номер ВУ от нецифровых символов
            const cleanDriverLicense = driverLicense ? parseInt(driverLicense.toString().replace(/\D/g, '')) : null;
            console.log('📝 Номер ВУ (очищенный):', cleanDriverLicense);

            // Сохраняем категории
            let categoriesId = null;
            if (driverLicenseCategories) {
                let categories = [];
                try {
                    categories = JSON.parse(driverLicenseCategories);
                } catch (e) {
                    // Если не JSON, пробуем как строку
                    categories = driverLicenseCategories.split(',').map(c => c.trim());
                }

                if (categories.length > 0) {
                    const categoriesResult = await pool.request()
                        .input('kategoryA', sql.Bit, categories.includes('A') ? 1 : 0)
                        .input('kategoryB', sql.Bit, categories.includes('B') ? 1 : 0)
                        .input('kategoryC', sql.Bit, categories.includes('C') ? 1 : 0)
                        .input('kategoryD', sql.Bit, categories.includes('D') ? 1 : 0)
                        .input('kategoryM', sql.Bit, categories.includes('M') ? 1 : 0)
                        .query(`
                            INSERT INTO Categories (KategoryA, KategoryB, KategoryC, KategoryD, KategoryM)
                            OUTPUT INSERTED.CategoriesId
                            VALUES (@kategoryA, @kategoryB, @kategoryC, @kategoryD, @kategoryM)
                        `);

                    categoriesId = categoriesResult.recordset[0]?.CategoriesId;
                    console.log('✅ Категории сохранены, ID:', categoriesId);
                }
            }

            // Сохраняем водительское удостоверение
            if (cleanDriverLicense && !isNaN(cleanDriverLicense) && cleanDriverLicense > 0) {
                const existingLicense = await pool.request()
                    .input('license', sql.Int, cleanDriverLicense)
                    .query('SELECT DriverLicenseNumber FROM DriverLicense WHERE DriverLicenseNumber = @license');

                if (existingLicense.recordset.length === 0) {
                    await pool.request()
                        .input('license', sql.Int, cleanDriverLicense)
                        .input('licenseDate', sql.Date, driverLicenseDate)
                        .input('categoriesId', sql.Int, categoriesId || 1)
                        .query(`
                            INSERT INTO DriverLicense (DriverLicenseNumber, DateOfIssue, AvailableCategories)
                            VALUES (@license, @licenseDate, @categoriesId)
                        `);
                    console.log('✅ Водительское удостоверение сохранено');
                } else {
                    console.log('✅ Водительское удостоверение уже существует');
                }

                // Обновляем клиента
                await pool.request()
                    .input('clientId', sql.Int, userId)
                    .input('license', sql.Int, cleanDriverLicense)
                    .query(`
                        UPDATE Client 
                        SET DriverLicenseNumber = @license
                        WHERE ClientId = @clientId
                    `);
                console.log('✅ ВУ привязано к клиенту');
            } else {
                console.warn('⚠️ Номер ВУ пропущен (некорректный формат):', driverLicense);
            }
        } catch (err) {
            console.error('❌ Ошибка при сохранении ВУ:', err.message);
        }

        console.log('✅ Все данные успешно сохранены');

        res.json({
            success: true,
            message: 'Документы успешно загружены. Ожидайте проверки администратором.',
            applicationId: applicationId,
            documents: documents
        });

    } catch (error) {
        console.error('❌ Ошибка загрузки документов:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка при загрузке документов: ' + error.message
        });
    }
};

// Получить документы для верификации (админ)
export const getDocumentsForVerification = async (req, res) => {
    try {
        console.log('📋 ====== НАЧАЛО ЗАПРОСА ======');
        console.log('📋 Запрос на получение заявок для верификации');
        console.log('📋 User ID (администратор):', req.user?.userId);

        const pool = await connectDB();

        // Проверяем, есть ли вообще заявки
        const allApps = await pool.request().query(`
            SELECT ApplicationId, Status, IsDocumentsVerified 
            FROM ApplicationForRegistration
        `);
        console.log('📋 Все заявки в БД:', allApps.recordset.length);
        console.log('📋 Статусы заявок:', allApps.recordset.map(a => a.Status));

        const result = await pool.request().query(`
            SELECT 
                afr.ApplicationId,
                afr.Status,
                afr.ApplicationDate,
                afr.IsDocumentsVerified,
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
                v.YearOfRelease,
                v.VINNumber,
                pd.DocumentId as PassportDocId,
                pd.DocumentPath as PassportPath,
                dld.DocumentId as DriverLicenseDocId,
                dld.DocumentPath as DriverLicensePath,
                sd.DocumentId as StsDocId,
                sd.DocumentPath as StsPath
             FROM ApplicationForRegistration afr
            JOIN Client c ON afr.ClientId = c.ClientId
            LEFT JOIN Vehicle v ON afr.RegistrationNumber = v.RegistrationNumber
            LEFT JOIN InsuranceProduct ip ON afr.ProductId = ip.ProductId
            LEFT JOIN UserDocuments pd ON afr.PassportDocumentId = pd.DocumentId
            LEFT JOIN UserDocuments dld ON afr.DriverLicenseDocumentId = dld.DocumentId
            LEFT JOIN UserDocuments sd ON afr.StsDocumentId = sd.DocumentId
            WHERE afr.Status IN ('Ожидание документов', 'Документы проверены')
               OR (afr.IsDocumentsVerified = 0 AND afr.Status != 'Отменено')
            ORDER BY afr.ApplicationDate DESC
        `);

        console.log(`📊 Найдено заявок для верификации: ${result.recordset.length}`);

        if (result.recordset.length > 0) {
            console.log('📋 Первая заявка:', {
                id: result.recordset[0].ApplicationId,
                status: result.recordset[0].Status,
                client: result.recordset[0].ClientSurname
            });
        }

        const applications = result.recordset.map(row => ({
            applicationId: row.ApplicationId,
            status: row.Status,
            applicationDate: row.ApplicationDate,
            isDocumentsVerified: row.IsDocumentsVerified,
            productId: row.ProductId,
            productName: row.ProductName,
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
                brand: row.VehicleBrand,
                model: row.VehicleModel,
                year: row.YearOfRelease,
                vin: row.VINNumber
            } : null,
            documents: {
                passport: row.PassportPath ? { id: row.PassportDocId, path: row.PassportPath } : null,
                driverLicense: row.DriverLicensePath ? { id: row.DriverLicenseDocId, path: row.DriverLicensePath } : null,
                sts: row.StsPath ? { id: row.StsDocId, path: row.StsPath } : null
            }
        }));

        console.log('📤 Отправка ответа с', applications.length, 'заявками');

        res.json({
            success: true,
            count: applications.length,
            applications: applications
        });

    } catch (error) {
        console.error('❌ ОШИБКА в getDocumentsForVerification:', error);
        console.error('❌ Стек ошибки:', error.stack);
        res.status(500).json({
            success: false,
            error: 'Ошибка при получении документов: ' + error.message
        });
    }
};

// Функция для отправки уведомления об отказе
async function sendRejectionEmail(clientEmail, clientName, applicationId) {
    try {
        console.log(`📧 Отправка уведомления об отказе на ${clientEmail}...`);
        
        const transporter = nodemailer.createTransport({
            host: process.env.EMAIL_HOST,
            port: parseInt(process.env.EMAIL_PORT),
            secure: process.env.EMAIL_PORT == '465',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASSWORD
            },
            tls: {
                rejectUnauthorized: false
            },
            connectionTimeout: 10000,
            greetingTimeout: 10000,
            socketTimeout: 15000,
            debug: false
        });
        
        const mailOptions = {
            from: `"АвтоСтрах" <${process.env.EMAIL_USER}>`,
            to: clientEmail,
            subject: `❌ Отказ в оформлении страхового полиса`,
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <title>Отказ в оформлении полиса</title>
                    <style>
                        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                        .container { max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px; }
                        .header { background: #e74c3c; color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
                        .content { padding: 20px; }
                        .footer { text-align: center; padding: 15px; font-size: 12px; color: #666; border-top: 1px solid #ddd; margin-top: 20px; }
                        .rejection-code { font-size: 24px; color: #e74c3c; font-weight: bold; text-align: center; margin: 20px 0; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h2>Отказ в оформлении полиса</h2>
                        </div>
                        <div class="content">
                            <p>Уважаемый(ая) <strong>${clientName}</strong>!</p>
                            <p>Ваша заявка №${applicationId} на оформление страхового полиса отклонена.</p>
                            <div class="rejection-code">
                                ❌ ОТКАЗАНО
                            </div>
                            <p>Вы можете подать новую заявку через личный кабинет.</p>
                            <p>С уважением,<br>Команда АвтоСтрах</p>
                        </div>
                        <div class="footer">
                            <p>Это автоматическое сообщение, пожалуйста, не отвечайте на него.</p>
                        </div>
                    </div>
                </body>
                </html>
            `
        };
        
        const info = await transporter.sendMail(mailOptions);
        console.log(`✅ Уведомление об отказе отправлено на ${clientEmail}, ID: ${info.messageId}`);
        return true;
        
    } catch (error) {
        console.error(`❌ Ошибка отправки уведомления об отказе:`, error.message);
        return false;
    }
}

// Подтверждение документов администратором и создание полиса
export const verifyDocumentsAndCreatePolicy = async (req, res) => {
    try {
        const { applicationId } = req.params;
        const { isVerified, notes } = req.body;
        const adminId = req.user.userId;

        console.log(`🔍 Верификация заявки ${applicationId}, админ: ${adminId}, решение: ${isVerified}`);

        const pool = await connectDB();

        // 1. Получаем информацию о заявке
        const application = await pool.request()
            .input('appId', sql.Int, applicationId)
            .query(`
                SELECT 
                    afr.*,
                    c.ClientSurname,
                    c.ClientName,
                    c.ClientPatronymic,
                    c.ClientEmail,
                    c.ClientPhoneNumber,
                    v.RegistrationNumber,
                    v.VehicleBrand,
                    v.VehicleModel,
                    v.YearOfRelease,
                    v.EnginePower
                FROM ApplicationForRegistration afr
                JOIN Client c ON afr.ClientId = c.ClientId
                LEFT JOIN Vehicle v ON afr.RegistrationNumber = v.RegistrationNumber
                WHERE afr.ApplicationId = @appId
            `);

        if (application.recordset.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Заявка не найдена'
            });
        }

        const app = application.recordset[0];

        const productId = app.ProductId || 1;

        // 2. Находим или создаём запись сотрудника для администратора
        let employeeId;

        // Проверяем, есть ли уже сотрудник с таким же email как у администратора
        const existingEmployee = await pool.request()
            .input('adminId', sql.Int, adminId)
            .query(`
                SELECT e.EmployeeId 
                FROM Employee e
                JOIN Client c ON e.EmployeeEmail = c.ClientEmail
                WHERE c.ClientId = @adminId
            `);

        if (existingEmployee.recordset.length > 0) {
            employeeId = existingEmployee.recordset[0].EmployeeId;
            console.log(`✅ Найден сотрудник ID: ${employeeId}`);
        } else {
            // Создаём запись сотрудника для администратора
            const adminInfo = await pool.request()
                .input('adminId', sql.Int, adminId)
                .query(`
                    SELECT ClientSurname, ClientName, ClientPatronymic, ClientEmail
                    FROM Client
                    WHERE ClientId = @adminId
                `);

            if (adminInfo.recordset.length > 0) {
                const admin = adminInfo.recordset[0];
                const insertResult = await pool.request()
                    .input('surname', sql.NVarChar, admin.ClientSurname)
                    .input('name', sql.NVarChar, admin.ClientName)
                    .input('patronymic', sql.NVarChar, admin.ClientPatronymic || null)
                    .input('email', sql.NVarChar, admin.ClientEmail)
                    .input('postId', sql.Int, 1) // Должность администратора
                    .query(`
                        INSERT INTO Employee (EmployeeSurname, EmployeeName, EmployeePatronymic, EmployeeEmail, PostId, HireDate, IsActive)
                        OUTPUT INSERTED.EmployeeId
                        VALUES (@surname, @name, @patronymic, @email, @postId, GETDATE(), 1)
                    `);

                employeeId = insertResult.recordset[0].EmployeeId;
                console.log(`✅ Создан новый сотрудник ID: ${employeeId}`);
            } else {
                // Если не нашли - используем временного сотрудника ID=1
                employeeId = 1;
                console.log(`⚠️ Используем сотрудника по умолчанию ID: ${employeeId}`);
            }
        }

        if (!isVerified) {
            // Если документы не прошли проверку
            await pool.request()
                .input('appId', sql.Int, applicationId)
                .input('status', sql.NVarChar, 'Документы отклонены')
                .query(`
                    UPDATE ApplicationForRegistration 
                    SET Status = @status
                    WHERE ApplicationId = @appId
                `);

                let emailSent = false;
            if (app.ClientEmail) {
                const clientName = `${app.ClientSurname} ${app.ClientName} ${app.ClientPatronymic || ''}`.trim();
                emailSent = await sendRejectionEmail(app.ClientEmail, clientName, applicationId);
            }

            return res.json({
                success: true,
                message: emailSent 
                    ? 'Документы отклонены. Уведомление отправлено клиенту.'
                    : 'Документы отклонены, но email не отправлен',
                emailSent: emailSent
            });
        }

        // 3. Если документы подтверждены
        // Обновляем статус заявки
        await pool.request()
            .input('appId', sql.Int, applicationId)
            .input('verifiedAt', sql.DateTime, new Date())
            .query(`
                UPDATE ApplicationForRegistration 
                SET IsDocumentsVerified = 1,
                    VerifiedAt = @verifiedAt,
                    Status = 'Документы проверены'
                WHERE ApplicationId = @appId
            `);

        // 4. Обновляем документы как проверенные (используем employeeId)
        await pool.request()
            .input('appId', sql.Int, applicationId)
            .input('verifiedBy', sql.Int, employeeId)
            .input('verifiedAt', sql.DateTime, new Date())
            .query(`
                UPDATE ud
                SET IsVerified = 1,
                    VerifiedBy = @verifiedBy,
                    VerifiedAt = @verifiedAt
                FROM UserDocuments ud
                WHERE ud.DocumentId IN (
                    SELECT PassportDocumentId FROM ApplicationForRegistration WHERE ApplicationId = @appId
                    UNION
                    SELECT DriverLicenseDocumentId FROM ApplicationForRegistration WHERE ApplicationId = @appId
                    UNION
                    SELECT StsDocumentId FROM ApplicationForRegistration WHERE ApplicationId = @appId
                )
            `);

        // 5. Создаём страховой полис
        const startDate = new Date();
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(startDate);
        endDate.setFullYear(endDate.getFullYear() + 1);
        endDate.setHours(23, 59, 59, 999);

        let baseCost = 5000; // Базовая стоимость

        const policyResult = await pool.request()
            .input('startDate', sql.Date, startDate)
            .input('endDate', sql.Date, endDate)
            .input('policyCost', sql.Decimal, baseCost)
            .input('applicationId', sql.Int, applicationId)
            .query(`
        INSERT INTO InsurancePolicy 
            (StartDate, EndDate, PolicyStatus, PolicyCost, DateOfRegistration, ApplicationId)
        OUTPUT INSERTED.PolicyNumber
        VALUES (@startDate, @endDate, 1, @policyCost, GETDATE(), @applicationId)
    `);

        const newPolicyNumber = policyResult.recordset[0].PolicyNumber;

        // 6. Обновляем статус заявки
        await pool.request()
            .input('appId', sql.Int, applicationId)
            .input('status', sql.NVarChar, 'Завершено')
            .input('policyGenerated', sql.Bit, 1)
            .query(`
                UPDATE ApplicationForRegistration 
                SET Status = @status,
                    PolicyGenerated = @policyGenerated
                WHERE ApplicationId = @appId
            `);

        console.log(`✅ Полис ${newPolicyNumber} создан для заявки ${applicationId}`);

        // ========== 7. ОТПРАВКА EMAIL КЛИЕНТУ ==========
        let emailSent = false;

        if (app.ClientEmail) {
            try {
                console.log(`📧 Отправка email на ${app.ClientEmail}...`);

                // БЕЗОПАСНОЕ ПРЕОБРАЗОВАНИЕ ГОСНОМЕРА В СТРОКУ И ОЧИСТКА
                let cleanRegistrationNumber = 'не указан';

                if (app.RegistrationNumber) {
                    // Преобразуем в строку, если это число
                    const regNumberStr = String(app.RegistrationNumber);
                    console.log(`🔧 Исходный госномер: "${regNumberStr}" (тип: ${typeof app.RegistrationNumber})`);

                    // Очищаем от дублирования
                    if (regNumberStr.includes(',')) {
                        cleanRegistrationNumber = regNumberStr.split(',')[0].trim();
                    } else {
                        cleanRegistrationNumber = regNumberStr.trim();
                    }

                    // Проверяем на точное дублирование (например "М999НК126,М999НК126")
                    const parts = cleanRegistrationNumber.split(',');
                    if (parts.length === 2 && parts[0].trim() === parts[1].trim()) {
                        cleanRegistrationNumber = parts[0].trim();
                    }

                    console.log(`🔧 Очищенный госномер: "${cleanRegistrationNumber}"`);
                }

                let policyTypeName = 'ОСАГО';
                let policyTypeDetails = 'Обязательное страхование гражданской ответственности';

                if (app.ProductId === 2) {
                    policyTypeName = 'КАСКО';
                    policyTypeDetails = 'Добровольное страхование от ущерба и угона';
                }

                const transporter = nodemailer.createTransport({
                    host: process.env.EMAIL_HOST,
                    port: parseInt(process.env.EMAIL_PORT),
                    secure: process.env.EMAIL_PORT == '465',
                    auth: {
                        user: process.env.EMAIL_USER,
                        pass: process.env.EMAIL_PASSWORD
                    },
                    tls: {
                        rejectUnauthorized: false
                    },
                    connectionTimeout: 10000,
                    greetingTimeout: 10000,
                    socketTimeout: 15000,
                    debug: false
                });

                const mailOptions = {
                    from: `"ИП НОВИКОВ К.В." <${process.env.EMAIL_USER}>`,
                    to: app.ClientEmail,
                    subject: `✅ Ваш страховой полис №${newPolicyNumber} оформлен`,
                    html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <title>Страховой полис</title>
                    <style>
                        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                        .container { max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px; }
                        .header { background: #2ecc71; color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
                        .content { padding: 20px; }
                        .policy-number { font-size: 24px; color: #2ecc71; font-weight: bold; text-align: center; margin: 20px 0; }
                        .footer { text-align: center; padding: 15px; font-size: 12px; color: #666; border-top: 1px solid #ddd; margin-top: 20px; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h2>Страховой полис оформлен!</h2>
                        </div>
                        <div class="content">
                            <p>Уважаемый(ая) <strong>${app.ClientSurname} ${app.ClientName} ${app.ClientPatronymic || ''}</strong>!</p>
                            <p>Ваш страховой полис успешно оформлен.</p>
                            <div class="policy-number">
                                № ${newPolicyNumber}
                            </div>
                            <p><strong>Тип полиса:</strong> ${policyTypeName} (${policyTypeDetails})</p>
                            <p><strong>Дата начала действия:</strong> ${startDate.toLocaleDateString('ru-RU')}</p>
                            <p><strong>Дата окончания действия:</strong> ${endDate.toLocaleDateString('ru-RU')}</p>
                            <p><strong>Транспортное средство:</strong> ${app.VehicleBrand} ${app.VehicleModel}</p>
                            <p><strong>Государственный номер:</strong> ${cleanRegistrationNumber}</p>
                            <hr>
                            <p>С уважением,<br>Команда "ИП НОВИКОВ К.В."</p>
                        </div>
                        <div class="footer">
                            <p>Это автоматическое сообщение, пожалуйста, не отвечайте на него.</p>
                        </div>
                    </div>
                </body>
                </html>
            `
                };

                const result = await sendEmailWithRetry(transporter, mailOptions);
                emailSent = true;
                console.log(`✅ Email отправлен на ${app.ClientEmail}, ID: ${result.info.messageId}`);

                // Сохраняем в БД факт отправки
                await pool.request()
                    .input('appId', sql.Int, applicationId)
                    .input('policyNumber', sql.Int, newPolicyNumber)
                    .input('sentTo', sql.NVarChar, app.ClientEmail)
                    .input('status', sql.NVarChar, 'sent')
                    .query(`
                INSERT INTO PolicyEmails (ApplicationId, PolicyNumber, SentTo, SentAt, Status)
                VALUES (@appId, @policyNumber, @sentTo, GETDATE(), @status)
            `);

            } catch (emailError) {
                console.error('❌ Ошибка отправки email:', emailError.message);
            }
        } else {
            console.warn(`⚠️ У клиента нет email, отправка невозможна`);
        }

        res.json({
            success: true,
            message: emailSent
                ? 'Документы подтверждены, полис создан и отправлен на email'
                : 'Документы подтверждены, полис создан, но email не отправлен',
            policyNumber: newPolicyNumber,
            startDate: startDate,
            endDate: endDate,
            emailSent: emailSent,
            client: {
                email: app.ClientEmail,
                name: `${app.ClientSurname} ${app.ClientName}`
            }
        });

    } catch (error) {
        console.error('❌ Ошибка верификации:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка при верификации документов: ' + error.message
        });
    }
};

async function sendEmailWithRetry(transporter, mailOptions, maxRetries = 3) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            const info = await transporter.sendMail(mailOptions);
            return { success: true, info };
        } catch (error) {
            console.log(`Попытка ${i + 1}/${maxRetries} не удалась: ${error.message}`);
            if (i === maxRetries - 1) throw error;
            // Ждём 2 секунды перед следующей попыткой
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }
}