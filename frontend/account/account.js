// В cabinet.js или account.js
document.addEventListener('DOMContentLoaded', function () {
    const API_URL = 'http://localhost:3001/api';

    // Элементы DOM
    const userNameElement = document.querySelector('.header__name');
    const logoutBtn = document.getElementById('logout-btn');
    const vehiclesContainer = document.querySelector('.account__container');

    // Функция проверки авторизации
    function checkAuth() {
        const token = localStorage.getItem('token');
        const userStr = localStorage.getItem('user');

        console.log('🔍 Проверка авторизации:', {
            token: token ? 'есть' : 'нет',
            user: userStr ? 'есть' : 'нет'
        });

        // Если нет токена или пользователя - перенаправляем на вход
        if (!token || !userStr) {
            window.location.href = '../autentification/autentification.html';
            return false;
        }

        try {
            // Проверяем, не истёк ли токен
            const tokenData = JSON.parse(atob(token.split('.')[1]));
            const exp = tokenData.exp * 1000; // в миллисекундах

            if (Date.now() >= exp) {
                // Токен истёк
                console.log('⏰ Токен истёк');
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                window.location.href = 'login.html?expired=true';
                return false;
            }

            // Отображаем имя пользователя
            const user = JSON.parse(userStr);
            if (user.surname && user.name) {
                userNameElement.textContent = `${user.surname} ${user.name}`;
            } else if (user.fullName) {
                userNameElement.textContent = user.fullName;
            } else if (user.email) {
                userNameElement.textContent = user.email;
            }

            return true;

        } catch (e) {
            console.error('❌ Ошибка проверки токена:', e);
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = 'login.html';
            return false;
        }
    }

    // Функция загрузки данных кабинета
    async function loadDashboard() {
        const token = localStorage.getItem('token');

        try {

            const response = await fetch(`${API_URL}/users/dashboard`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            const data = await response.json();

            if (data.success) {
                // Обновляем данные пользователя
                const user = JSON.parse(localStorage.getItem('user') || '{}');
                localStorage.setItem('user', JSON.stringify({
                    ...user,
                    ...data.user
                }));

                // Отображаем автомобили
                renderVehicles(data.vehicles);

            } else {

                // Если ошибка авторизации - перенаправляем на вход
                if (data.error.includes('токен') || data.error.includes('авторизац')) {
                    localStorage.removeItem('token');
                    localStorage.removeItem('user');
                    window.location.href = 'login.html';
                } else {
                    showError(data.error || 'Ошибка загрузки данных');
                }
            }

        } catch (error) {
            showError('Не удалось загрузить данные. Проверьте соединение с сервером.');
        }
    }

    // Функция отображения автомобилей
    function renderVehicles(vehicles) {
        if (!vehicles || vehicles.length === 0) {
            vehiclesContainer.innerHTML = `
                <div class="no-data">
                    <p>У вас пока нет добавленных автомобилей</p>
                    <a href="../form/form.html" class="btn-primary">Записаться на приём</a>
                </div>
            `;
            return;
        }

        let html = '';
        vehicles.forEach(vehicle => {
            const activePolicy = vehicle.policies?.find(p => p.status === 1) || vehicle.policies?.[0];

            //Проверка активности полиса
            if (new Date(activePolicy.endDate) < new Date()) {
                activePolicy.status = 0
            }

            html += `
                <div class="account__card flex">
                    <div class="account__cars cars">
                        <h3 class="cars__title">Автомобиль</h3>
                        <div class="cars__block">
                            <div class="cars__block__item item">
                                <p class="item_descr"><strong>Марка:</strong> ${vehicle.brand || 'Не указана'}</p>
                                <p class="item_descr"><strong>Модель:</strong> ${vehicle.model || 'Не указана'}</p>
                                <p class="item_descr"><strong>Год:</strong> ${vehicle.year || 'Не указан'}</p>
                                <p class="item_descr"><strong>Мощность:</strong> ${vehicle.enginePower || '?'} л.с.</p>
                                <p class="item_descr"><strong>VIN:</strong> ${vehicle.vinNumber || 'Не указан'}</p>
                                <p class="item_descr"><strong>СТС:</strong> ${vehicle.stsNumber || 'Не указан'}</p>
                                <p class="item_descr"><strong>Госномер:</strong> ${vehicle.registrationNumber || 'Не указан'}</p>
                            </div>
                        </div>
                    </div>
                    <div class="account__policies">
                        <h3 class="policies__title">Полис</h3>
                        <div class="policies__block">
                            ${activePolicy ? `
                                <div class="policies__block__item item">
                                    <p class="item_descr"><strong>Номер:</strong> ${activePolicy.policyNumber || 'Не указан'}</p>
                                    <p class="item_descr"><strong>Действует:</strong> ${formatDate(activePolicy.startDate)} - ${formatDate(activePolicy.endDate)}</p>
                                    <p class="item_descr"><strong>Статус:</strong> ${activePolicy.status == 1 ? '✅ Активен' : '❌ Неактивен'}</p>
                                    <p class="item_descr"><strong>Тип:</strong> ${activePolicy.productType || 'ОСАГО'}</p>
                                </div>
                            ` : `
                                <div class="policies__block__item item">
                                    <p class="item_descr">Нет активного полиса</p>
                                    <a href="../form/form.html" class="btn-small">Оформить</a>
                                </div>
                            `}
                        </div>
                    </div>
                </div>
            `;
        });

        vehiclesContainer.innerHTML = html;
    }

    // Форматирование даты
    function formatDate(dateString) {
        if (!dateString) return 'не указана';
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString('ru-RU');
        } catch {
            return dateString;
        }
    }

    // Показать ошибку
    function showError(message) {
        vehiclesContainer.innerHTML = `
            <div class="error-message">
                <p>❌ ${message}</p>
                <button onclick="window.location.reload()">Обновить страницу</button>
            </div>
        `;
    }

    // Выход из аккаунта
    function logout() {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '../autentification/autentification.html';
    }

    // Обработчик кнопки выхода
    if (logoutBtn) {
        logoutBtn.addEventListener('click', logout);
    }

    // Инициализация
    console.log('🚀 Запуск личного кабинета');

    // Сначала показываем загрузку
    if (vehiclesContainer) {
        vehiclesContainer.innerHTML = '<div class="loading">Загрузка данных...</div>';
    }

    // Проверяем авторизацию и загружаем данные
    if (checkAuth()) {
        loadDashboard();
    }
});