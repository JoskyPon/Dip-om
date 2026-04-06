// backend/controllers/emailController.js
import nodemailer from 'nodemailer';
import sql from 'mssql';
import { connectDB } from '../config/db.js';

// Проверка переменных окружения
console.log('📧 EMAIL_USER:', process.env.EMAIL_USER ? process.env.EMAIL_USER : '❌ не установлен');
console.log('📧 EMAIL_PASSWORD:', process.env.EMAIL_PASSWORD ? 'установлен' : '❌ не установлен');
console.log('📧 EMAIL_HOST:', process.env.EMAIL_HOST);
console.log('📧 EMAIL_PORT:', process.env.EMAIL_PORT);

// Настройка транспортера для Gmail
const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT),
    secure: process.env.EMAIL_PORT == '465',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
    },
    tls: {
        rejectUnauthorized: false,
        ciphers: 'SSLv3'
    },
    connectionTimeout: 60000,
    greetingTimeout: 60000,
    socketTimeout: 60000,
    debug: true,
    logger: true
});

// Проверка подключения при старте
transporter.verify(function(error, success) {
    if (error) {
        console.error('❌ Ошибка подключения к SMTP серверу:', error.message);
    } else {
        console.log('✅ SMTP сервер Gmail готов к отправке писем');
    }
});

// Отправка полиса на email
export const sendPolicyEmail = async (req, res) => {
    try {
        const { applicationId } = req.params;
        
        console.log('📧 Отправка email для заявки:', applicationId);
        
        const pool = await connectDB();
        
        // Получаем данные для письма
        const result = await pool.request()
            .input('appId', sql.Int, applicationId)
            .query(`
                SELECT 
                    afr.ApplicationId,
                    ip.PolicyNumber,
                    ip.StartDate,
                    ip.EndDate,
                    ip.PolicyCost,
                    c.ClientEmail,
                    c.ClientSurname,
                    c.ClientName,
                    c.ClientPatronymic,
                    v.VehicleBrand,
                    v.VehicleModel,
                    v.RegistrationNumber
                FROM ApplicationForRegistration afr
                JOIN InsurancePolicy ip ON afr.ApplicationId = ip.ApplicationId
                JOIN Client c ON afr.ClientId = c.ClientId
                LEFT JOIN Vehicle v ON afr.RegistrationNumber = v.RegistrationNumber
                WHERE afr.ApplicationId = @appId
            `);
        
        if (result.recordset.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Полис не найден'
            });
        }
        
        const data = result.recordset[0];
        
        if (!data.ClientEmail) {
            return res.status(400).json({
                success: false,
                error: 'У клиента не указан email'
            });
        }
        
        console.log('📧 Отправка на email:', data.ClientEmail);
        
        // Форматируем даты
        const startDate = new Date(data.StartDate).toLocaleDateString('ru-RU');
        const endDate = new Date(data.EndDate).toLocaleDateString('ru-RU');
        
        // Формируем HTML письма
        const emailHtml = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>Ваш страховой полис</title>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px; }
                    .header { background: #667eea; color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
                    .content { padding: 20px; }
                    .policy-details { background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 15px 0; }
                    .footer { text-align: center; padding: 15px; font-size: 12px; color: #666; border-top: 1px solid #ddd; margin-top: 20px; }
                    .highlight { font-weight: bold; color: #667eea; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h2>Страховой полис</h2>
                        <p>АвтоСтрах</p>
                    </div>
                    <div class="content">
                        <p>Уважаемый(ая) <strong>${data.ClientSurname} ${data.ClientName} ${data.ClientPatronymic || ''}</strong>!</p>
                        <p>Ваш страховой полис успешно оформлен. Детали полиса:</p>
                        
                        <div class="policy-details">
                            <p><strong>Номер полиса:</strong> <span class="highlight">${data.PolicyNumber}</span></p>
                            <p><strong>Дата начала действия:</strong> ${startDate}</p>
                            <p><strong>Дата окончания действия:</strong> ${endDate}</p>
                            <p><strong>Стоимость полиса:</strong> ${Number(data.PolicyCost).toLocaleString()} руб.</p>
                            <hr>
                            <p><strong>Застрахованное транспортное средство:</strong></p>
                            <p>${data.VehicleBrand} ${data.VehicleModel}</p>
                            <p>Государственный регистрационный номер: ${data.RegistrationNumber}</p>
                        </div>
                        
                        <p>Полис действует на всей территории Российской Федерации.</p>
                        <p>При наступлении страхового случая обращайтесь по телефону горячей линии: <strong>8-800-XXX-XX-XX</strong></p>
                        <p>Вы всегда можете скачать электронную версию полиса в вашем личном кабинете.</p>
                    </div>
                    <div class="footer">
                        <p>© ${new Date().getFullYear()} АвтоСтрах. Все права защищены.</p>
                        <p>Это письмо сформировано автоматически, пожалуйста, не отвечайте на него.</p>
                    </div>
                </div>
            </body>
            </html>
        `;
        
        // Настройки письма
        const mailOptions = {
            from: `"АвтоСтрах" <${process.env.EMAIL_USER}>`,
            to: data.ClientEmail,
            subject: `Ваш страховой полис №${data.PolicyNumber}`,
            html: emailHtml,
            text: `Ваш страховой полис №${data.PolicyNumber} оформлен. Детали в письме.`
        };
        
        console.log('📧 Отправка письма...');
        
        // Отправляем email
        const info = await transporter.sendMail(mailOptions);
        
        console.log('✅ Email отправлен:', info.messageId);
        
        // Сохраняем информацию об отправке
        await pool.request()
            .input('appId', sql.Int, applicationId)
            .input('policyNumber', sql.Int, data.PolicyNumber)
            .input('sentTo', sql.NVarChar, data.ClientEmail)
            .input('emailContent', sql.NVarChar, emailHtml.substring(0, 8000))
            .input('status', sql.NVarChar, 'sent')
            .query(`
                INSERT INTO PolicyEmails 
                    (ApplicationId, PolicyNumber, SentTo, SentAt, EmailContent, Status)
                VALUES (@appId, @policyNumber, @sentTo, GETDATE(), @emailContent, @status)
            `);
        
        // Обновляем статус отправки
        await pool.request()
            .input('appId', sql.Int, applicationId)
            .input('sentAt', sql.DateTime, new Date())
            .query(`
                UPDATE ApplicationForRegistration 
                SET PolicySentAt = @sentAt
                WHERE ApplicationId = @appId
            `);
        
        res.json({
            success: true,
            message: 'Полис отправлен на email',
            email: data.ClientEmail,
            messageId: info.messageId
        });
        
    } catch (error) {
        console.error('❌ Ошибка отправки email:', error);
        
        res.status(500).json({
            success: false,
            error: 'Ошибка при отправке email: ' + error.message
        });
    }
};