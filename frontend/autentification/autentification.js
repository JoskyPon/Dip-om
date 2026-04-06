document.addEventListener('DOMContentLoaded', function () {

    const API_URL = 'http://localhost:3001/api'

    const goRegBtn = document.querySelector('#go-reg')
    const goLoginBtn = document.querySelector('#go-login')
    const loginContainer = document.querySelector('.aut')
    const regContainer = document.querySelector('.reg')
    const loginDescr = document.querySelector('#aut-descr')
    const regDescr = document.querySelector('#reg-descr')
    const regbtn = document.querySelector('#reg-btn')
    const loginBtn = document.querySelector('#login-btn')

    goRegBtn.addEventListener('click', function () {
        goRegBtn.classList.add('display-none')
        regDescr.classList.add('display-none')
        loginContainer.classList.add('display-none')
        goLoginBtn.classList.remove('display-none')
        loginDescr.classList.remove('display-none')
        regContainer.classList.remove('display-none')
    })

    goLoginBtn.addEventListener('click', function () {
        goRegBtn.classList.remove('display-none')
        regDescr.classList.remove('display-none')
        loginContainer.classList.remove('display-none')
        goLoginBtn.classList.add('display-none')
        loginDescr.classList.add('display-none')
        regContainer.classList.add('display-none')
    })

    // Функция регистрации
    async function registrationUser() {
        const surname = document.querySelector('#surname').value.trim()
        const name = document.querySelector('#name').value.trim()
        const patronymic = document.querySelector('#patronymic').value.trim()
        const phoneNumber = document.querySelector('#phone-number').value.trim()
        const regEmail = document.querySelector('#reg-email').value.trim()
        const regPassword = document.querySelector('#reg-password').value.trim()
        const secondPassword = document.querySelector('#second-password').value.trim()
        const checkbox = document.querySelector('#agree')

        const itemError = document.querySelectorAll('.reg__item__error')

        //Валидация полей с фамилией, именем и отчеством
        if (!surname) {
            itemError[0].innerHTML = 'Поле не может быть пустым'
        } else {
            itemError[0].innerHTML = ''
        }

        if (!name) {
            itemError[1].innerHTML = 'Поле не может быть пустым'
        } else {
            itemError[1].innerHTML = ''
        }

        if (!patronymic) {
            itemError[2].innerHTML = 'Поле не может быть пустым'
        } else {
            itemError[2].innerHTML = ''
        }

        //Валидация номера телефона
        if (phoneNumber.length !== 11) {
            itemError[4].innerHTML = 'Номер телефона должен состоять из 11 цифр'
        } else {
            itemError[4].innerHTML = ''
        }

        //Валидация Email и вывод сообщения с ошибкой
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (regEmail && !emailRegex.test(regEmail)) {
            itemError[5].innerHTML = 'Email должен содержать @ и окончание'
        } else if (!regEmail) {
            itemError[5].innerHTML = 'Email не может быть пустым'
        } else {
            itemError[5].innerHTML = ''
        }

        //Валидация пароля и вывод сообщения с ошибкой
        if (!regPassword) {
            itemError[6].innerHTML = 'Пароль не может быть пустым'
        } else if (regPassword.length < 6) {
            itemError[6].innerHTML = 'Минимальная длина пароля - 6 символов'
        } else {
            itemError[6].innerHTML = ''
        }

        if (regPassword !== secondPassword) {
            itemError[7].innerHTML = 'Пароли не совпадают'
        } else {
            itemError[7].innerHTML = ''
        }

        if (!checkbox.checked) {
            itemError[3].innerHTML = 'Согласие обязательно'
        } else {
            itemError[3].innerHTML = ''
        }

        //Прерывание отправки данных на сервер если присутствуют ошибки при заполнении полей
        for (let i = 0; i <= 6; i++) {
            if (itemError[i] === '') {
                return
            }
        }

        try {
            const response = await fetch(`${API_URL}/auth/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    surname: surname,
                    name: name,
                    patronymic: patronymic,
                    phoneNumber: phoneNumber,
                    regEmail: regEmail,
                    regPassword: regPassword
                })
            })

            const data = await response.json()
            console.log(data)

            if (data.success) {
                alert('Регистрация успешна!')
                // Сохраняем токен
                localStorage.setItem('token', data.token)
                localStorage.setItem('user', JSON.stringify(data.user))
                // Перенаправляем в личный кабинет
                window.location.href = '../account/account.html'
            }


        } catch (error) {
            console.error(`Возникла ошибка:`, error)
            alert('Ошибка соединения с сервером')
        }
    }

    regbtn.addEventListener('click', function (e) {
        e.preventDefault()
        registrationUser()
    })

    // Функция входа
    async function loginUser() {
        const login = document.querySelector('#aut-email').value.trim()
        const password = document.querySelector('#aut-password').value.trim()
        const itemError = document.querySelectorAll('.aut__item__error')

        //Валидация Email и вывод сообщения с ошибкой
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (login && !emailRegex.test(login)) {
            itemError[0].innerHTML = 'Email должен содержать @ и окончание'
        } else if (!login) {
            itemError[0].innerHTML = 'Email не может быть пустым'
        } else {
            itemError[0].innerHTML = ''
        }

        //Валидация пароля и вывод сообщения с ошибкой
        if (!password) {
            itemError[1].innerHTML = 'Пароль не может быть пустым'
        } else if (password.length < 6) {
            itemError[1].innerHTML = 'Минимальная длина пароля - 6 символов'
        } else {
            itemError[1].innerHTML = ''
        }

        //Прерывание отправки данных на сервер если присутствуют ошибки при заполнении полей
        if (itemError[0] === '' || itemError[1] === '') {
            return
        }


        try {
            const response = await fetch(`${API_URL}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ login: login, password: password })
            })

            const data = await response.json()

            console.log('Ответ сервера:', data)

            if (data.success) {
                alert('Вход выполнен!')
                localStorage.setItem('token', data.token)
                localStorage.setItem('user', JSON.stringify(data.user))
                window.location.href = '../account/account.html'
                itemError[2].innerHTML = ''
            } else {
                itemError[2].innerHTML = 'Неверный логин или пароль'
            }

        } catch (error) {
            console.error('Ошибка:', error)
            alert('Ошибка соединения с сервером')
        }
    }

    async function loginAdmin() {
        const login = document.querySelector('#aut-email').value.trim()
        const password = document.querySelector('#aut-password').value.trim()
        const itemError = document.querySelectorAll('.aut__item__error')

        //Валидация Email и вывод сообщения с ошибкой
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (login && !emailRegex.test(login)) {
            itemError[0].innerHTML = 'Email должен содержать @ и окончание'
        } else if (!login) {
            itemError[0].innerHTML = 'Email не может быть пустым'
        } else {
            itemError[0].innerHTML = ''
        }

        //Валидация пароля и вывод сообщения с ошибкой
        if (!password) {
            itemError[1].innerHTML = 'Пароль не может быть пустым'
        } else if (password.length < 6) {
            itemError[1].innerHTML = 'Минимальная длина пароля - 6 символов'
        } else {
            itemError[1].innerHTML = ''
        }

        //Прерывание отправки данных на сервер если присутствуют ошибки при заполнении полей
        if (itemError[0] === '' || itemError[1] === '') {
            return
        }


        try {
            const response = await fetch(`${API_URL}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ login: login, password: password })
            })

            const data = await response.json()

            console.log('Ответ сервера:', data)

            if (data.success) {
                alert('Вход выполнен!')
                localStorage.setItem('token', data.token)
                localStorage.setItem('user', JSON.stringify(data.user))
                window.location.href = '../admin/admin.html'
                itemError[2].innerHTML = ''
            } else {
                itemError[2].innerHTML = 'Неверный логин или пароль'
            }

        } catch (error) {
            console.error('Ошибка:', error)
            alert('Ошибка соединения с сервером')
        }
    }

    loginBtn.addEventListener('click', function (e) {
        e.preventDefault()
        if (login = 'admin@mail.ru') {
            loginAdmin()
        } else {
            loginUser()
        }
    })



})