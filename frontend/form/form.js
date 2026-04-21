document.addEventListener('DOMContentLoaded', function () {

    const API_URL = 'http://localhost:3001/api'

    function checkAuth() {
        const token = localStorage.getItem('token');
        const user = localStorage.getItem('user');

        if (!token || !user) {
            // Сохраняем информацию о том, что хотели записаться
            sessionStorage.setItem('pendingAppointment', 'true');

            // Если не авторизован - показываем сообщение и кнопку входа
            const authCheck = document.getElementById('auth-check');
            authCheck.innerHTML = `
                <div class="auth-warning">
                    <h3>Требуется авторизация</h3>
                    <p>Для записи на приём необходимо войти в личный кабинет</p>
                    <button onclick="window.location.href='login.html'">Войти</button>
                    <button onclick="window.location.href='register.html'">Зарегистрироваться</button>
                </div>
            `;

            // Скрываем форму записи
            document.querySelector('.form__container').style.display = 'none';
            return false;
        }

        try {
            const tokenData = JSON.parse(atob(token.split('.')[1]));
            const exp = tokenData.exp * 1000;

            if (Date.now() >= exp) {
                // Токен истёк
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                window.location.href = 'login.html?expired=true';
                return false;
            }
        } catch (e) {
        }

        // Если авторизован - показываем форму
        document.querySelector('.form__container').style.display = 'block';
        return true;
    }

    function displayAvailableTimes(availableTimes) {
        const timeSelect = document.getElementById('appointment-time');
        const selectedDate = document.getElementById('appointment-date').value;

        // Сохраняем выбранное время (если было)
        const currentSelectedTime = timeSelect.value;

        // Очищаем select
        timeSelect.innerHTML = '<option value="1">Выберите время</option>';

        if (availableTimes && availableTimes.length > 0) {
            // Добавляем только доступное время
            availableTimes.forEach(time => {
                const option = document.createElement('option');
                option.value = time; // Храним в 24-часовом формате для отправки
                option.textContent = time; // Отображаем время
                timeSelect.appendChild(option);
            });

            // Если ранее выбранное время всё ещё доступно, восстанавливаем его
            if (currentSelectedTime && currentSelectedTime !== '1' && availableTimes.includes(currentSelectedTime)) {
                timeSelect.value = currentSelectedTime;
            }
        } else {
            // Если нет доступного времени
            timeSelect.innerHTML = '<option value="1">Нет свободного времени</option>';
        }

        // Убираем индикатор загрузки
        const loadingElement = document.getElementById('time-loading');
        if (loadingElement) loadingElement.style.display = 'none';
    }

    // Функция проверки доступного времени
    async function checkAvailableTime(selectedDate) {

        // Показываем индикатор загрузки
        const timeSelect = document.getElementById('appointment-time');
        timeSelect.innerHTML = '<option value="1">Загрузка...</option>';

        // Добавляем индикатор загрузки, если его нет
        let loadingElement = document.getElementById('time-loading');
        if (!loadingElement) {
            loadingElement = document.createElement('div');
            loadingElement.id = 'time-loading';
            loadingElement.className = 'loading-spinner-small';
            loadingElement.textContent = 'Проверка доступного времени...';
            timeSelect.parentNode.appendChild(loadingElement);
        }
        loadingElement.style.display = 'block';

        try {
            const response = await fetch(`${API_URL}/appointments/check-time?date=${selectedDate}`);
            const data = await response.json();

            if (data.success) {
                // Отображаем доступное время
                displayAvailableTimes(data.availableTimes);

                // Если есть занятое время, показываем предупреждение
                if (data.busyTimes && data.busyTimes.length > 0) {
                }
            } else {
                timeSelect.innerHTML = '<option value="1">Ошибка загрузки</option>';
                loadingElement.style.display = 'none';
            }
        } catch (error) {
            timeSelect.innerHTML = '<option value="1">Ошибка соединения</option>';
            const loadingElement = document.getElementById('time-loading');
            if (loadingElement) loadingElement.style.display = 'none';
        }
    }

    // Функция проверки, является ли день выходным (суббота или воскресенье)
    function isWeekend(dateString) {
        const date = new Date(dateString);
        const dayOfWeek = date.getDay(); // 0 - воскресенье, 6 - суббота
        return dayOfWeek === 0 || dayOfWeek === 6;
    }

    // Функция для отображения сообщения о выходном дне
    function showWeekendMessage(isWeekend) {
        const weekendWarning = document.getElementById('weekend-warning') || createWeekendWarning();

        if (isWeekend) {
            weekendWarning.style.display = 'block';
            // Блокируем выбор времени
            const timeSelect = document.getElementById('appointment-time');
            timeSelect.innerHTML = '<option value="1">Выходной день</option>';
            timeSelect.disabled = true;
        } else {
            weekendWarning.style.display = 'none';
            // Разблокируем выбор времени
            const timeSelect = document.getElementById('appointment-time');
            timeSelect.disabled = false;
            // Загружаем доступное время для рабочего дня
            const selectedDate = document.getElementById('appointment-date').value;
            checkAvailableTime(selectedDate);
        }
    }

    // Создаём элемент для предупреждения о выходном дне
    function createWeekendWarning() {
        const warning = document.createElement('div');
        warning.id = 'weekend-warning';
        warning.className = 'weekend-warning';
        warning.innerHTML = `
        <p>Выходной день</p>
        <p>Приём осуществляется только в будние дни (пн-пт)</p>
    `;

        // Вставляем после поля выбора даты
        const dateInput = document.getElementById('appointment-date');
        dateInput.parentNode.insertBefore(warning, dateInput.nextSibling);

        return warning;
    }

    // Выполняем проверку
    const isAuth = checkAuth();
    if (!isAuth) return; // Останавливаем выполнение, если не авторизован

    const recordButton = document.querySelector('#record-btn')

    if (!recordButton) {
        return;
    }

    // Обработчик изменения даты
    document.getElementById('appointment-date').addEventListener('change', function (e) {
        const selectedDate = e.target.value;

        // Проверяем, не выходной ли это день
        const weekend = isWeekend(selectedDate);
        showWeekendMessage(weekend);

        if (!weekend) {
            // Если рабочий день - проверяем доступное время
            checkAvailableTime(selectedDate);
        }
    });

    // Устанавливаем минимальную дату - сегодня
    const today = new Date().toISOString().split('T')[0];
    const dateInput = document.getElementById('appointment-date');
    dateInput.min = today;
    dateInput.value = today;

    // При загрузке страницы проверяем доступное время для сегодняшней даты
    checkAvailableTime(today);

    //Функция записи клиента
    async function recordUser(appointmentDateTime) {
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
        const appointmentTime = document.querySelector('#appointment-time').value
        const appointmentPolicy = document.querySelector('#appointment-policy').value

        const itemError = document.querySelectorAll('.input__error')

        //Валидация серии номера паспорта
        if (!passport) {
            itemError[0].innerHTML = 'Поле не может быть пустым'
        } else if (passport.length !== 10) {
            itemError[0].innerHTML = 'Серия и номер паспорта должны состоять из 10 цифр'
        } else {
            itemError[0].innerHTML = ''
        }

        //валидация даты выдачи паспорта
        if (!passportDate) {
            itemError[1].innerHTML = 'Поле не может быть пустым'
        } else {
            itemError[1].innerHTML = ''
        }

        if (!issuedBy) {
            itemError[2].innerHTML = 'Поле не может быть пустым'
        } else {
            itemError[2].innerHTML = ''
        }

        //валидация номера ВУ
        if (!driverLicense) {
            itemError[3].innerHTML = 'Поле не может быть пустым'
        } else if (driverLicense.length !== 10) {
            itemError[3].innerHTML = 'Номер ВУ должен состоять из 10 цифр'
        } else {
            itemError[3].innerHTML = ''
        }

        //Валидация даты выдачи ВУ
        if (!driverLicenseDate) {
            itemError[4].innerHTML = 'Поле не может быть пустым'
        } else {
            itemError[4].innerHTML = ''
        }

        const checkboxes = document.querySelectorAll('.checkbox__input')
        const selectedCategories = []

        checkboxes.forEach(checkbox => {
            if (checkbox.checked) {
                selectedCategories.push(checkbox.value);
            }
        });

        //Валидация выбранных категорий
        if (selectedCategories.length === 0) {
            itemError[5].innerHTML = 'Поле не может быть пустым'
        } else {
            itemError[5].innerHTML = ''
        }

        //Валидация регистрационного номера
        if (!carRegistrationNumber) {
            itemError[6].innerHTML = 'Поле не может быть пустым'
        } else if (carRegistrationNumber.length < 8 || carRegistrationNumber.length > 9) {
            itemError[6].innerHTML = 'Номер должен содержать от 8 до 9 символов'
        } else {
            itemError[6].innerHTML = ''
        }

        //Валидация VIN-номера
        if (!carVIN) {
            itemError[7].innerHTML = 'Поле не может быть пустым'
        } else if (carVIN.length !== 17) {
            itemError[7].innerHTML = 'Номер должен состоять из 17 символов'
        } else {
            itemError[7].innerHTML = ''
        }

        //Валидация марки автомобиля
        if (!carBrand) {
            itemError[8].innerHTML = 'Поле не может быть пустым'
        } else {
            itemError[8].innerHTML = ''
        }

        //Валидация модели автомобиля
        if (!carModel) {
            itemError[9].innerHTML = 'Поле не может быть пустым'
        } else {
            itemError[9].innerHTML = ''
        }

        //Валидация года выпуска автомобиля
        if (!carDate) {
            itemError[10].innerHTML = 'Поле не может быть пустым'
        } else {
            itemError[10].innerHTML = ''
        }

        //Валидация номера СТС
        if (!carSTS) {
            itemError[11].innerHTML = 'Поле не может быть пустым'
        } else if (carSTS.length !== 10) {
            itemError[11].innerHTML = 'Номер должен состоять из 10 символов'
        } else {
            itemError[11].innerHTML = ''
        }

        //Валидация мощности двигателя
        if (!carPower) {
            itemError[12].innerHTML = 'Поле не может быть пустым'
        } else if (carPower > 1500) {
            itemError[12].innerHTML = 'Введите настоящую мощность'
        } else {
            itemError[12].innerHTML = ''
        }

        //Валидация выбранного времени
        if (appointmentTime == 1) {
            itemError[13].innerHTML = 'Выберите подходящее время'
            itemError[13].style.cssText = 'margin-bottom: 20px'
        } else {
            itemError[13].innerHTML = ''
            itemError[13].style.cssText = 'margin-bottom: 0'
        }

        const token = localStorage.getItem('token');

        try {
            const response = await fetch(`${API_URL}/appointments`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    passport: passport,
                    passportDate: passportDate,
                    passportIssuedBy: issuedBy,
                    driverLicense: driverLicense,
                    driverLicenseDate: driverLicenseDate,
                    driverLicenseCategories: selectedCategories,
                    carRegistrationNumber: carRegistrationNumber,
                    carVIN: carVIN,
                    carBrand: carBrand,
                    carModel: carModel,
                    carDate: carDate,
                    carSTS: carSTS,
                    carPower: carPower,
                    dateOfVisit: appointmentDateTime,
                    appointmentPolicy: appointmentPolicy
                }),
            })

            const data = await response.json();

            if (data.success) {
                alert(`Запись создана! Номер заявки: ${data.applicationId}`);
            } else {
                alert(`Ошибка: ${data.error}`);
            }

            console.log(data);
        } catch (error) {
            alert('Произошла ошибка при отправке данных');
        }
    }

    recordButton.addEventListener('click', function (e) {
        e.preventDefault();

        const timeSelect = document.getElementById('appointment-time');

        if (!timeSelect) {
            alert('Ошибка: не найден элемент выбора времени');
            return;
        }

        if (timeSelect.value === '1' || timeSelect.value === 'Нет свободного времени') {
            alert('Пожалуйста, выберите доступное время');
            return;
        }

        const date = document.getElementById('appointment-date').value;
        const time = timeSelect.value;
        const appointmentDateTime = `${date}T${time}:00`;

        recordUser(appointmentDateTime);
    })
})