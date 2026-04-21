// frontend/js/document-upload.js
const API_URL = 'http://localhost:3001/api';

document.addEventListener('DOMContentLoaded', function () {
    // Проверка авторизации
    function checkAuth() {
        const token = localStorage.getItem('token');
        const user = localStorage.getItem('user');

        if (!token || !user) {
            sessionStorage.setItem('pendingAppointment', 'true');
            const authCheck = document.getElementById('auth-check');
            if (authCheck) {
                authCheck.innerHTML = `
                    <div class="auth-warning">
                        <h3>⚠️ Требуется авторизация</h3>
                        <p>Для загрузки документов необходимо войти в личный кабинет</p>
                        <button onclick="window.location.href='../autentification/autentification.html'">Войти</button>
                        <button onclick="window.location.href='../autentification/autentification.html'">Зарегистрироваться</button>
                    </div>
                `;
            }
            const formContainer = document.querySelector('.form__container');
            if (formContainer) formContainer.style.display = 'none';
            return false;
        }

        const formContainer = document.querySelector('.form__container');
        if (formContainer) formContainer.style.display = 'block';
        return true;
    }

    if (!checkAuth()) return;

    // Отображение выбранных файлов
    const fileInputs = {
        'passport-photo': 'passport-file-name',
        'driver-license-photo': 'license-file-name',
        'sts-photo': 'sts-file-name'
    };

    Object.entries(fileInputs).forEach(([inputId, spanId]) => {
        const input = document.getElementById(inputId);
        const span = document.getElementById(spanId);

        if (input && span) {
            input.addEventListener('change', () => {
                if (input.files.length > 0) {
                    span.textContent = input.files[0].name;
                } else {
                    span.textContent = 'Файл не выбран';
                }
            });
        }
    });

    // Получение выбранных категорий
    function getSelectedCategories() {
        const categories = [];
        document.querySelectorAll('.checkbox__input:checked').forEach(cb => {
            categories.push(cb.value);
        });
        return categories;
    }

    // Валидация формы
    function validateForm() {
        let isValid = true;
        const errors = document.querySelectorAll('.input__error');

        // Очищаем ошибки
        errors.forEach(err => err.innerHTML = '');

        // Проверка паспорта
        const passport = document.getElementById('passport')?.value.trim();
        if (!passport) {
            showError(0, 'Поле не может быть пустым');
            isValid = false;
        } else if (passport.length !== 10) {
            showError(0, 'Серия и номер паспорта должны состоять из 10 цифр');
            isValid = false;
        }

        // Проверка даты паспорта
        const passportDate = document.getElementById('passport-date')?.value;
        if (!passportDate) {
            showError(1, 'Поле не может быть пустым');
            isValid = false;
        }

        // Проверка кем выдан
        const issuedBy = document.getElementById('passport-issued')?.value.trim();
        if (!issuedBy) {
            showError(2, 'Поле не может быть пустым');
            isValid = false;
        }

        // Проверка ВУ
        const driverLicense = document.getElementById('driver-license')?.value.trim();
        if (!driverLicense) {
            showError(3, 'Поле не может быть пустым');
            isValid = false;
        } else if (driverLicense.length !== 10) {
            showError(3, 'Номер ВУ должен состоять из 10 цифр');
            isValid = false;
        }

        // Проверка даты ВУ
        const driverLicenseDate = document.getElementById('driver-license-date')?.value;
        if (!driverLicenseDate) {
            showError(4, 'Поле не может быть пустым');
            isValid = false;
        }

        // Проверка категорий
        const categories = getSelectedCategories();
        if (categories.length === 0) {
            showError(5, 'Выберите хотя бы одну категорию');
            isValid = false;
        }

        // Проверка автомобиля
        const carRegNumber = document.getElementById('car-registration-number')?.value.trim();
        if (!carRegNumber) {
            showError(6, 'Поле не может быть пустым');
            isValid = false;
        }

        const carVIN = document.getElementById('car-VIN')?.value.trim();
        if (!carVIN) {
            showError(7, 'Поле не может быть пустым');
            isValid = false;
        } else if (carVIN.length !== 17) {
            showError(7, 'VIN должен состоять из 17 символов');
            isValid = false;
        }

        const carBrand = document.getElementById('car-brand')?.value.trim();
        if (!carBrand) {
            showError(8, 'Поле не может быть пустым');
            isValid = false;
        }

        const carModel = document.getElementById('car-model')?.value.trim();
        if (!carModel) {
            showError(9, 'Поле не может быть пустым');
            isValid = false;
        }

        const carDate = document.getElementById('car-date')?.value;
        if (!carDate) {
            showError(10, 'Поле не может быть пустым');
            isValid = false;
        }

        const carSTS = document.getElementById('car-STS')?.value.trim();
        if (!carSTS) {
            showError(11, 'Поле не может быть пустым');
            isValid = false;
        } else if (carSTS.length !== 10) {
            showError(11, 'Номер СТС должен состоять из 10 символов');
            isValid = false;
        }

        const carPower = document.getElementById('car-power')?.value;
        if (!carPower) {
            showError(12, 'Поле не может быть пустым');
            isValid = false;
        }

        // Проверка файлов
        const passportPhoto = document.getElementById('passport-photo')?.files[0];
        const driverLicensePhoto = document.getElementById('driver-license-photo')?.files[0];
        const stsPhoto = document.getElementById('sts-photo')?.files[0];

        if (!passportPhoto) {
            alert('Пожалуйста, загрузите фото паспорта');
            isValid = false;
        }
        if (!driverLicensePhoto) {
            alert('Пожалуйста, загрузите фото водительского удостоверения');
            isValid = false;
        }
        if (!stsPhoto) {
            alert('Пожалуйста, загрузите фото СТС');
            isValid = false;
        }

        return isValid;
    }

    function showError(index, message) {
        const errors = document.querySelectorAll('.input__error');
        if (errors[index]) {
            errors[index].innerHTML = message;
        }
    }

    // Отправка документов
    const submitBtn = document.getElementById('record-btn');

    if (!submitBtn) {
        return;
    }

    async function uploadDocuments() {
        const passportPhoto = document.getElementById('passport-photo')?.files[0];
        const driverLicensePhoto = document.getElementById('driver-license-photo')?.files[0];
        const stsPhoto = document.getElementById('sts-photo')?.files[0];

        // Проверка, что все документы загружены
        if (!passportPhoto || !driverLicensePhoto || !stsPhoto) {
            alert('Пожалуйста, загрузите все три фотографии документов');
            return;
        }

        // Сбор данных из формы
        const passport = document.getElementById('passport')?.value.trim();
        const passportDate = document.getElementById('passport-date')?.value;
        const issuedBy = document.getElementById('passport-issued')?.value.trim();
        const driverLicense = document.getElementById('driver-license')?.value.trim();
        const driverLicenseDate = document.getElementById('driver-license-date')?.value;
        const carRegistrationNumber = document.getElementById('car-registration-number')?.value.trim();
        const carVIN = document.getElementById('car-VIN')?.value.trim();
        const carBrand = document.getElementById('car-brand')?.value.trim();
        const carModel = document.getElementById('car-model')?.value.trim();
        const carDate = document.getElementById('car-date')?.value;
        const carSTS = document.getElementById('car-STS')?.value.trim();
        const carPower = document.getElementById('car-power')?.value;
        const appointmentPolicy = document.querySelector('#appointment-policy').value

        // Сбор категорий
        const categories = [];
        document.querySelectorAll('.checkbox__input:checked').forEach(cb => {
            categories.push(cb.value);
        });

        if (categories.length === 0) {
            alert('Выберите хотя бы одну категорию водительского удостоверения');
            return;
        }

        const token = localStorage.getItem('token');

        const formData = new FormData();

        // Добавляем файлы
        formData.append('passportPhoto', passportPhoto);
        formData.append('driverLicensePhoto', driverLicensePhoto);
        formData.append('stsPhoto', stsPhoto);

        // Добавляем текстовые данные
        formData.append('passport', passport);
        formData.append('passportDate', passportDate);
        formData.append('passportIssuedBy', issuedBy);
        formData.append('driverLicense', driverLicense);
        formData.append('driverLicenseDate', driverLicenseDate);
        formData.append('driverLicenseCategories', JSON.stringify(categories));
        formData.append('carRegistrationNumber', carRegistrationNumber);
        formData.append('carVIN', carVIN);
        formData.append('carBrand', carBrand);
        formData.append('carModel', carModel);
        formData.append('carDate', carDate);
        formData.append('carSTS', carSTS);
        formData.append('carPower', carPower);
        formData.append('appointmentPolicy', appointmentPolicy);

        submitBtn.disabled = true;
        submitBtn.textContent = 'Отправка...';

        try {

            const response = await fetch(`${API_URL}/documents/upload`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData
            });

            const data = await response.json();

            if (data.success) {
                alert(`✅ ${data.message}\nНомер заявки: ${data.applicationId}`);
                window.location.href = '../account/account.html';
            } else {
                alert(`❌ Ошибка: ${data.error}`);
            }
        } catch (error) {
            alert('❌ Ошибка соединения с сервером');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Отправить';
        }
    }

    if (submitBtn) {
        submitBtn.addEventListener('click', function () {
            uploadDocuments()

            const passport = document.querySelector('#passport').value.trim()
            const passportDate = document.querySelector('#passport-date').value.trim()
            const issuedBy = document.querySelector('#passport-issued').value.trim()
            const driverLicense = document.querySelector('#driver-license').value.trim()
            const driverLicenseDate = document.querySelector('#driver-license-date').value.trim()
            const carRegistrationNumber = document.querySelector('#car-registration-number').value.trim()
            const carVIN = document.querySelector('#car-VIN').value.trim()
            const carBrand = document.querySelector('#car-brand').value.trim()
            const carModel = document.querySelector('#car-model').value.trim()
            const carDate = document.querySelector('#car-date').value.trim()
            const carSTS = document.querySelector('#car-STS').value.trim()
            const carPower = document.querySelector('#car-power').value.trim()
            const itemError = document.querySelectorAll('.input__error')

            validateForm()

            const checkboxes = document.querySelectorAll('.checkbox__input')
            const selectedCategories = []

            checkboxes.forEach(checkbox => {
                if (checkbox.checked) {
                    selectedCategories.push(checkbox.value);
                }
            });
        });
    }
});
