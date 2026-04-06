import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Создаём папку для загрузок
const uploadDir = path.join(__dirname, '../../uploads/documents');
console.log('📁 Папка для загрузок:', uploadDir);

if (!fs.existsSync(uploadDir)) {
    console.log('📁 Создаю папку:', uploadDir);
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Настройка хранилища
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        console.log(`📂 Сохранение файла ${file.originalname} в ${uploadDir}`);
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        const filename = `${file.fieldname}-${uniqueSuffix}${ext}`;
        console.log(`📄 Имя файла: ${filename}`);
        cb(null, filename);
    }
});

// Фильтр файлов
const fileFilter = (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
    console.log(`🔍 Проверка файла: ${file.originalname}, тип: ${file.mimetype}`);
    
    if (allowedTypes.includes(file.mimetype)) {
        console.log('✅ Тип файла разрешён');
        cb(null, true);
    } else {
        console.log('❌ Тип файла запрещён');
        cb(new Error('Неподдерживаемый формат файла. Разрешены: JPEG, PNG, PDF'), false);
    }
};

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
    fileFilter: fileFilter
});

// Мидлвар для загрузки документов
export const uploadDocuments = upload.fields([
    { name: 'passportPhoto', maxCount: 1 },
    { name: 'driverLicensePhoto', maxCount: 1 },
    { name: 'stsPhoto', maxCount: 1 }
]);

// Обработчик ошибок multer
export const handleMulterError = (err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ error: 'Файл слишком большой. Максимум 5MB.' });
        }
        return res.status(400).json({ error: `Ошибка загрузки: ${err.message}` });
    }
    if (err) {
        return res.status(400).json({ error: err.message });
    }
    next();
};