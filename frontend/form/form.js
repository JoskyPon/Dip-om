document.addEventListener('DOMContentLoaded', function () {

    const recordButton = document.querySelector('#record-btn')

    // Функция для генерации времени с интервалом 15 минут
    function generateTimeSlots(selectedDate) {
        const timeSelect = document.getElementById('appointment-time');
        timeSelect.innerHTML = '<option value="1">Выберите время</option>';

        // Начало рабочего дня (например, 9:00)
        const startHour = 9;
        const endHour = 18; // Конец рабочего дня (18:00)

        // Если выбранная дата - сегодня, начинаем с текущего времени
        const now = new Date();
        const selectedDateObj = new Date(selectedDate);
        const isToday = selectedDateObj.toDateString() === now.toDateString();

        let currentHour = startHour;
        let currentMinute = 0;

        if (isToday) {
            currentHour = now.getHours();
            currentMinute = Math.ceil(now.getMinutes() / 15) * 15; // Округляем до следующего 15-минутного интервала

            if (currentMinute >= 60) {
                currentHour++;
                currentMinute = 0;
            }
        }

        // Генерируем слоты с 9:00 до 18:00 с шагом 15 минут
        for (let hour = currentHour; hour < endHour; hour++) {
            for (let minute = (hour === currentHour ? currentMinute : 0); minute < 60; minute += 15) {
                // Форматируем время (HH:MM)
                const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;

                // Формат для отображения (24-часовой формат)
                const displayTime = `${hour}:${minute.toString().padStart(2, '0')}`;

                const option = document.createElement('option');
                option.value = timeString; // Храним в 24-часовом формате для отправки
                option.textContent = displayTime;
                timeSelect.appendChild(option);
            }
        }
    }

    // Обработчик изменения даты
    document.getElementById('appointment-date').addEventListener('change', function (e) {
        generateTimeSlots(e.target.value);
    });

    // Устанавливаем минимальную дату - сегодня
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('appointment-date').min = today;
    document.getElementById('appointment-date').value = today;

    // Генерируем слоты для сегодняшней даты при загрузке
    generateTimeSlots(today);

    //Функция записи клиента
    async function recordUser(appointmentDateTime) {
        const passport = document.querySelector('#passport').value.trim()
        const passportDate = document.querySelector('#passport-date').value.trim()
        const driverLicense = document.querySelector('#driver-license').value.trim()
        const driverLicenseDate = document.querySelector('#driver-license-date').value.trim()
        const carRegistrationNumber = document.querySelector('#car-registration-number').value.trim()
        const carVIN = document.querySelector('#car-VIN').value.trim()
        const carBrand = document.querySelector('#car-brand').value.trim()
        const carModel = document.querySelector('#car-model').value.trim()
        const carDate = document.querySelector('#car-date').value.trim()
        const carSTS = document.querySelector('#car-STS').value.trim()
        const carCategory = document.querySelector('#car-category').value
        const appointmentTime = document.querySelector('#appointment-time > option:checked').value

        const itemError = document.querySelectorAll('.input__error')

        console.log(carCategory)

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

        //валидация номера ВУ
        if (!driverLicense) {
            itemError[2].innerHTML = 'Поле не может быть пустым'
        } else if (driverLicense.length !== 10) {
            itemError[2].innerHTML = 'Серия и номер паспорта должны состоять из 10 цифр'
        } else {
            itemError[2].innerHTML = ''
        }

        //Валидация даты выдачи ВУ
        if (!driverLicenseDate) {
            itemError[3].innerHTML = 'Поле не может быть пустым'
        } else {
            itemError[3].innerHTML = ''
        }

        const checkboxes = document.querySelectorAll('.checkbox__input')
        let selectedCategories = []

        console.log(selectedCategories)

        checkboxes.forEach(checkbox => {
            if (checkbox.checked) {
                selectedCategories.push(checkbox.value);
            }
        });

        if (selectedCategories.length === 0) {
            itemError[4].innerHTML = 'Поле не может быть пустым'
        } else {
            itemError[4].innerHTML = ''
        }

        if (!carRegistrationNumber) {
            itemError[5].innerHTML = 'Поле не может быть пустым'
        } else if (carRegistrationNumber.length < 8 || carRegistrationNumber.length > 9) {
            itemError[5].innerHTML = 'Номер должен содержать от 8 до 9 символов'
        } else {
            itemError[5].innerHTML = ''
        }

        if (!carVIN) {
            itemError[6].innerHTML = 'Поле не может быть пустым'
        } else if (carVIN.length !== 17) {
            itemError[6].innerHTML = 'Номер должен состоять из 17 символов'
        } else {
            itemError[6].innerHTML = ''
        }

        if (!carBrand) {
            itemError[7].innerHTML = 'Поле не может быть пустым'
        } else {
            itemError[7].innerHTML = ''
        }

        if (!carModel) {
            itemError[8].innerHTML = 'Поле не может быть пустым'
        } else {
            itemError[8].innerHTML = ''
        }

        if (!carDate) {
            itemError[9].innerHTML = 'Поле не может быть пустым'
        } else {
            itemError[9].innerHTML = ''
        }

        if (!carSTS) {
            itemError[10].innerHTML = 'Поле не может быть пустым'
        } else if (carSTS.length !== 10) {
            itemError[10].innerHTML = 'Номер должен состоять из 10 символов'
        } else {
            itemError[10].innerHTML = ''
        }

        if (carCategory == 1) {
            itemError[11].innerHTML = 'Выберите категорию из списка'
        } else {
            itemError[11].innerHTML = ''
        }

        if (appointmentTime == 1) {
            itemError[12].innerHTML = 'Выберите подходящее время'
            itemError[12].style.cssText = 'margin-bottom: 20px'
        } else {
            itemError[12].innerHTML = ''
            itemError[12].style.cssText = 'margin-bottom: 0'
        }

        for (let i = 0; i <= 11; i++) {
            if (itemError[i] === '') {
                return
            }
        }

        try {
            const response = await fetch(`` / users, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    passport: passport,
                    passportDate: passportDate,
                    driverLicense: driverLicense,
                    driverLicenseDate: driverLicenseDate,
                    driverLicenseCategories: selectedCategories,
                    carRegistrationNumber: carRegistrationNumber,
                    carVIN: carVIN,
                    carBrand: carBrand,
                    carModel: carModel,
                    carDate: carDate,
                    carSTS: carSTS,
                    carCategory: carCategory,
                    dateOfVisit: appointmentDateTime
                }),
            })

            const data = await response.json()
            console.log(data)

        } catch (error) {
            console.log(error)
        }


    }

    recordButton.addEventListener('click', function (e) {
        e.preventDefault()
        const date = document.getElementById('appointment-date').value;
        const time = document.getElementById('appointment-time').value;

        // Объединяем дату и время для отправки на сервер
        const appointmentDateTime = `${date}T${time}:00`;
        console.log('Выбрано время:', appointmentDateTime);

        getUserInfo()
        recordUser(appointmentDateTime)
    })

    async function getUserInfo() {
        try {
            const response = await fetch(`` / users)
            const data = await response.json()
        } catch (error) {
            console.log(error)
        }
    }

})