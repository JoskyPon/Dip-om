const API_URL = 'http://localhost:3001/api';

// Проверка авторизации и прав администратора
async function checkAdminAuth() {
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user') || '{}');

    if (!token) {
        window.location.href = 'login.html';
        return false;
    }

    // Проверяем, что пользователь имеет роль admin (можно добавить проверку на сервере)
    if (user.role !== 'admin') {
        // Если роль не admin, пытаемся получить данные с сервера
        try {
            const response = await fetch(`${API_URL}/admin/stats`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.status === 403) {
                alert('У вас нет прав доступа к панели администратора');
                window.location.href = 'account.html';
                return false;
            }
        } catch (error) {
        }
    }

    // Отображаем имя администратора
    const adminNameElement = document.getElementById('admin-name');
    if (user.surname && user.name) {
        adminNameElement.textContent = `${user.surname} ${user.name}`;
    } else if (user.fullName) {
        adminNameElement.textContent = user.fullName;
    } else {
        adminNameElement.textContent = user.email || 'Администратор';
    }

    return true;
}

// Загрузка статистики
async function loadStats() {
    const token = localStorage.getItem('token');

    try {
        const response = await fetch(`${API_URL}/admin/stats`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const data = await response.json();

        if (data.success) {
            document.getElementById('stat-total').textContent = data.stats.total || 0;
            document.getElementById('stat-pending').textContent = data.stats.pending || 0;
            document.getElementById('stat-today').textContent = data.stats.today || 0;
            document.getElementById('stat-upcoming').textContent = data.stats.upcoming || 0;
        }
    } catch (error) {
    }
}

// Загрузка записей на приём
async function loadAppointments(filters = {}) {
    const token = localStorage.getItem('token');
    const container = document.getElementById('appointments-container');
    container.innerHTML = '<div class="loading">Загрузка записей...</div>';

    // Построение URL с параметрами
    let url = `${API_URL}/admin/appointments?`;
    const params = [];

    if (filters.status && filters.status !== 'all') {
        params.push(`status=${encodeURIComponent(filters.status)}`);
    }
    if (filters.startDate) {
        params.push(`startDate=${filters.startDate}`);
    }
    if (filters.endDate) {
        params.push(`endDate=${filters.endDate}`);
    }
    if (filters.search) {
        params.push(`search=${encodeURIComponent(filters.search)}`);
    }

    url += params.join('&');

    try {
        const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const data = await response.json();

        if (data.success) {
            renderAppointments(data.appointments);
        } else {
            container.innerHTML = `<div class="error-message">❌ ${data.error}</div>`;
        }
    } catch (error) {
        container.innerHTML = '<div class="error-message">❌ Ошибка соединения с сервером</div>';
    }
}

// Отображение записей в таблице
function renderAppointments(appointments) {
    const container = document.getElementById('appointments-container');

    if (!appointments || appointments.length === 0) {
        container.innerHTML = '<div class="no-data">Нет записей по заданным критериям</div>';
        return;
    }

    const statusClass = {
        'Ожидание': 'status-pending',
        'Завершено': 'status-completed',
        'Отменено': 'status-cancelled'
    };

    const statusText = {
        'Ожидание': '⏳ В ожидании',
        'Завершено': '✅ Завершено',
        'Отменено': '❌ Отменено'
    };

    let html = `
        <table class="appointments-table">
            <thead>
                <tr>
                    <th>Дата и время</th>
                    <th>Клиент</th>
                    <th>Автомобиль</th>
                    <th>Продукт</th>
                    <th>Статус</th>
                    <th>Действия</th>
                </tr>
            </thead>
            <tbody>
    `;

    appointments.forEach(apt => {
        const date = new Date(apt.applicationDate);
        const formattedDate = date.toLocaleString('ru-RU', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        html += `
            <tr>
                <td>${formattedDate}</td>
                <td>
                    <strong>${apt.client.fullName}</strong><br>
                    <small>${apt.client.phone || ''} ${apt.client.email || ''}</small>
                </td>
                <td>
                    ${apt.vehicle ? `${apt.vehicle.brand} ${apt.vehicle.model}<br><small>${apt.vehicle.registrationNumber || ''}</small>` : '—'}
                </td>
                <td>${apt.product?.name || 'ОСАГО'}</td>
                <td>
                    <span class="status-badge ${statusClass[apt.status] || ''}">
                        ${statusText[apt.status] || apt.status}
                    </span>
                </td>
                <td class="actions-cell">
                    <button class="view-details" data-id="${apt.applicationId}">📋 Подробнее</button>
        `;

        // Кнопка "Отменить" только для записей со статусом "Ожидание"
        if (apt.status === 'Ожидание') {
            html += `<button class="cancel-appointment" data-id="${apt.applicationId}" data-name="${apt.client.fullName}">❌ Отменить</button>`;
        }

        // Кнопка "Восстановить" для отменённых записей
        if (apt.status === 'Отменено') {
            html += `<button class="restore-appointment" data-id="${apt.applicationId}" data-name="${apt.client.fullName}">🔄 Восстановить</button>`;
        }

        // Кнопка "Завершить" для записей в ожидании
        if (apt.status === 'Ожидание') {
            html += `<button class="complete-appointment" data-id="${apt.applicationId}" data-name="${apt.client.fullName}">✅ Завершить</button>`;
        }

        html += `</td></tr>`;
    });

    html += `
            </tbody>
        </table>
    `;

    container.innerHTML = html;

    // Обработчики для кнопок "Подробнее"
    document.querySelectorAll('.view-details').forEach(btn => {
        btn.addEventListener('click', () => showAppointmentDetails(btn.dataset.id));
    });

    // Обработчики для кнопок "Отменить"
    document.querySelectorAll('.cancel-appointment').forEach(btn => {
        btn.addEventListener('click', () => {
            const appointmentId = btn.dataset.id;
            const clientName = btn.dataset.name;

            if (confirm(`Вы уверены, что хотите отменить запись клиента "${clientName}"?`)) {
                updateAppointmentStatus(appointmentId, 'Отменено');
            }
        });
    });

    // Обработчики для кнопок "Восстановить"
    document.querySelectorAll('.restore-appointment').forEach(btn => {
        btn.addEventListener('click', () => {
            const appointmentId = btn.dataset.id;
            const clientName = btn.dataset.name;

            if (confirm(`Восстановить запись клиента "${clientName}"?`)) {
                updateAppointmentStatus(appointmentId, 'Ожидание');
            }
        });
    });

    // Обработчики для кнопок "Завершить"
    document.querySelectorAll('.complete-appointment').forEach(btn => {
        btn.addEventListener('click', () => {
            const appointmentId = btn.dataset.id;
            const clientName = btn.dataset.name;

            if (confirm(`Подтвердить завершение записи клиента "${clientName}"?`)) {
                updateAppointmentStatus(appointmentId, 'Завершено');
            }
        });
    });
}

// Показать детали записи в модальном окне
async function showAppointmentDetails(id) {
    const token = localStorage.getItem('token');
    const modal = document.getElementById('appointment-modal');
    const modalBody = document.getElementById('modal-body');

    modal.style.display = 'flex';
    modalBody.innerHTML = '<div class="loading">Загрузка деталей...</div>';

    try {
        const response = await fetch(`${API_URL}/admin/appointments/${id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const data = await response.json();

        if (data.success) {
            const apt = data.appointment;
            const date = new Date(apt.applicationDate);
            const formattedDate = date.toLocaleString('ru-RU', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });

            modalBody.innerHTML = `
                <div class="appointment-details">
                    <h4>Информация о записи</h4>
                    <p><strong>Номер заявки:</strong> ${apt.applicationId}</p>
                    <p><strong>Дата и время:</strong> ${formattedDate}</p>
                    <p><strong>Статус:</strong> ${apt.status}</p>
                    
                    <h4>Информация о клиенте</h4>
                    <p><strong>ФИО:</strong> ${apt.client.fullName}</p>
                    <p><strong>Телефон:</strong> ${apt.client.phone || '—'}</p>
                    <p><strong>Email:</strong> ${apt.client.email || '—'}</p>
                    
                    ${apt.vehicle ? `
                        <h4>Информация об автомобиле</h4>
                        <p><strong>Госномер:</strong> ${apt.vehicle.registrationNumber || '—'}</p>
                        <p><strong>Марка/Модель:</strong> ${apt.vehicle.brand} ${apt.vehicle.model}</p>
                        <p><strong>VIN:</strong> ${apt.vehicle.vin || '—'}</p>
                        <p><strong>Год выпуска:</strong> ${apt.vehicle.year || '—'}</p>
                        <p><strong>Мощность:</strong> ${apt.vehicle.enginePower || '—'} л.с.</p>
                    ` : ''}
                    
                    ${apt.product ? `
                        <h4>Страховой продукт</h4>
                        <p><strong>Название:</strong> ${apt.product.name}</p>
                        <p><strong>Тип:</strong> ${apt.product.type}</p>
                    ` : ''}
                    
                    ${apt.employee ? `
                        <h4>Ответственный сотрудник</h4>
                        <p><strong>ФИО:</strong> ${apt.employee.surname} ${apt.employee.name}</p>
                    ` : ''}
                </div>
            `;
        } else {
            modalBody.innerHTML = `<div class="error-message">❌ ${data.error}</div>`;
        }
    } catch (error) {
        modalBody.innerHTML = '<div class="error-message">❌ Ошибка соединения с сервером</div>';
    }
}

// Поиск пользователей
async function searchUsers(query) {
    const token = localStorage.getItem('token');
    const resultsContainer = document.getElementById('search-results');

    if (!query || query.trim() === '') {
        resultsContainer.innerHTML = '<div class="no-data">Введите поисковый запрос для поиска пользователей</div>';
        return;
    }

    resultsContainer.innerHTML = '<div class="loading">Поиск...</div>';

    try {
        const response = await fetch(`${API_URL}/admin/users/search?query=${encodeURIComponent(query)}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const data = await response.json();

        if (data.success) {
            if (data.users.length === 0) {
                resultsContainer.innerHTML = '<div class="no-data">Пользователи не найдены</div>';
                return;
            }

            let html = '<div class="users-list">';
            data.users.forEach(user => {
                html += `
                    <div class="user-card">
                        <div class="user-name">${user.fullName}</div>
                        <div class="user-details">
                            📞 ${user.phone || '—'} | ✉️ ${user.email || '—'} | 
                            🚗 ${user.registrationNumber || 'нет автомобиля'}
                        </div>
                    </div>
                `;
            });
            html += '</div>';
            resultsContainer.innerHTML = html;
        } else {
            resultsContainer.innerHTML = `<div class="error-message">❌ ${data.error}</div>`;
        }
    } catch (error) {
        resultsContainer.innerHTML = '<div class="error-message">❌ Ошибка соединения с сервером</div>';
    }
}

// Выход из аккаунта
function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '../autentification/autentification.html';
}

async function updateAppointmentStatus(appointmentId, newStatus) {
    const token = localStorage.getItem('token');

    try {
        const response = await fetch(`${API_URL}/admin/appointments/${appointmentId}/status`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status: newStatus })
        });

        const data = await response.json();

        if (data.success) {
            alert(`✅ ${data.message}`);
            // Перезагружаем текущий список записей
            const currentFilters = getCurrentFilters();
            loadAppointments(currentFilters);
            // Обновляем статистику
            loadStats();
            return true;
        } else {
            alert(`❌ Ошибка: ${data.error}`);
            return false;
        }
    } catch (error) {
        alert('❌ Ошибка соединения с сервером');
        return false;
    }
}

// Получение текущих фильтров
function getCurrentFilters() {
    return {
        status: document.getElementById('filter-status').value,
        startDate: document.getElementById('filter-start-date').value,
        endDate: document.getElementById('filter-end-date').value,
        search: document.getElementById('filter-search').value
    };
}

async function loadDocumentsForVerification() {
    const token = localStorage.getItem('token');
    const container = document.getElementById('documents-container');
    container.innerHTML = '<div class="loading">Загрузка заявок...</div>';

    try {
        const response = await fetch(`${API_URL}/documents/pending-verification`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            }
        });

        const data = await response.json();

        if (data.success) {
            renderDocumentsForVerification(data.applications || []);
        } else {
            container.innerHTML = `<div class="error-message">❌ ${data.error}</div>`;
        }
    } catch (error) {
        container.innerHTML = '<div class="error-message">❌ Ошибка соединения с сервером</div>';
    }
}

// Отображение заявок на верификацию
function renderDocumentsForVerification(applications) {

    const container = document.querySelector('#documents-container');

    if (!container) {
        console.error('❌ Контейнер documents-container не найден!');
        return;
    }

    if (!applications || applications.length === 0) {
        container.innerHTML = '<div class="no-data">Нет заявок, ожидающих проверки документов</div>';
        return;
    }

    // Очищаем контейнер
    container.innerHTML = '';

    // Создаём карточки вручную через createElement
    applications.forEach((app) => {
        // Основная карточка
        const card = document.createElement('div');
        card.className = 'verification-card';
        card.style.cssText = 'background: white; border-radius: 10px; margin-bottom: 20px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); overflow: hidden;';

        // Заголовок карточки
        const cardHeader = document.createElement('div');
        cardHeader.className = 'card-header';
        cardHeader.style.cssText = 'background: #f8f9fa; padding: 15px 20px; border-bottom: 1px solid #e0e0e0; display: flex; justify-content: space-between; align-items: center;';

        const title = document.createElement('h3');
        title.textContent = `Заявка №${app.applicationId}`;
        title.style.margin = '0';

        const statusSpan = document.createElement('span');
        statusSpan.className = 'status-badge status-pending';
        statusSpan.style.cssText = 'background: #fff3cd; color: #856404; padding: 4px 8px; border-radius: 4px; font-size: 12px;';
        statusSpan.textContent = app.isDocumentsVerified ? 'Проверено' : 'Ожидает проверки';

        cardHeader.appendChild(title);
        cardHeader.appendChild(statusSpan);

        // Тело карточки
        const cardBody = document.createElement('div');
        cardBody.className = 'card-body';
        cardBody.style.cssText = 'padding: 20px; display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px;';

        // Информация о клиенте
        const clientInfo = document.createElement('div');
        clientInfo.className = 'client-info';
        clientInfo.style.cssText = 'background: #fafafa; padding: 15px; border-radius: 8px;';
        clientInfo.innerHTML = `
            <h4 style="margin-top: 0; margin-bottom: 10px; color: #667eea;">Информация о клиенте</h4>
            <p><strong>ФИО:</strong> ${app.client?.fullName || '—'}</p>
            <p><strong>Телефон:</strong> ${app.client?.phone || '—'}</p>
            <p><strong>Email:</strong> ${app.client?.email || '—'}</p>
            <p><strong>Дата заявки:</strong> ${new Date(app.applicationDate).toLocaleString('ru-RU')}</p>
        `;

        let productName = '';
        switch (app.productId) {
            case 1: productName = 'ОСАГО'; break;
            case 2: productName = 'КАСКО'; break;
            default: productName = 'ОСАГО';
        }

        // Информация об автомобиле
        const vehicleInfo = document.createElement('div');
        vehicleInfo.className = 'vehicle-info';
        vehicleInfo.style.cssText = 'background: #fafafa; padding: 15px; border-radius: 8px;';
        vehicleInfo.innerHTML = `
            <h4 style="margin-top: 0; margin-bottom: 10px; color: #667eea;">Автомобиль</h4>
            <p><strong>Госномер:</strong> ${app.vehicle?.registrationNumber || '—'}</p>
            <p><strong>Марка/Модель:</strong> ${app.vehicle?.brand || '—'} ${app.vehicle?.model || '—'}</p>
            <p><strong>Год:</strong> ${app.vehicle?.year || '—'}</p>
            <p><strong>VIN:</strong> ${app.vehicle?.vin || '—'}</p>
            <p><strong>Тип полиса:</strong> ${productName}</p>
        `;

        // Документы
        const documentsInfo = document.createElement('div');
        documentsInfo.className = 'documents-info';
        documentsInfo.style.cssText = 'background: #fafafa; padding: 15px; border-radius: 8px;';

        let documentsHtml = '<h4 style="margin-top: 0; margin-bottom: 10px; color: #667eea;">Документы для проверки</h4><div class="documents-grid">';

        documentsHtml += app.documents?.passport
            ? `<div class="document-item" style="display: flex; justify-content: space-between; align-items: center; padding: 8px; background: white; border-radius: 5px; margin-bottom: 5px;">
                <span>📄 Паспорт</span>
                <a href="http://localhost:3001${app.documents.passport.path}" target="_blank" style="color: #3498db; text-decoration: none;">Просмотреть</a>
               </div>`
            : '<div class="document-item missing" style="color: #e74c3c; padding: 8px;">❌ Паспорт не загружен</div>';

        documentsHtml += app.documents?.driverLicense
            ? `<div class="document-item" style="display: flex; justify-content: space-between; align-items: center; padding: 8px; background: white; border-radius: 5px; margin-bottom: 5px;">
                <span>🚗 Водительское удостоверение</span>
                <a href="http://localhost:3001${app.documents.driverLicense.path}" target="_blank" style="color: #3498db; text-decoration: none;">Просмотреть</a>
               </div>`
            : '<div class="document-item missing" style="color: #e74c3c; padding: 8px;">❌ ВУ не загружено</div>';

        documentsHtml += app.documents?.sts
            ? `<div class="document-item" style="display: flex; justify-content: space-between; align-items: center; padding: 8px; background: white; border-radius: 5px; margin-bottom: 5px;">
                <span>📋 СТС</span>
                <a href="http://localhost:3001${app.documents.sts.path}" target="_blank" style="color: #3498db; text-decoration: none;">Просмотреть</a>
               </div>`
            : '<div class="document-item missing" style="color: #e74c3c; padding: 8px;">❌ СТС не загружен</div>';

        documentsHtml += '</div>';
        documentsInfo.innerHTML = documentsHtml;

        cardBody.appendChild(clientInfo);
        cardBody.appendChild(vehicleInfo);
        cardBody.appendChild(documentsInfo);

        // Кнопки действий
        const cardActions = document.createElement('div');
        cardActions.className = 'card-actions';
        cardActions.style.cssText = 'padding: 15px 20px; background: #f8f9fa; border-top: 1px solid #e0e0e0; display: flex; gap: 10px; justify-content: flex-end;';

        const verifyBtn = document.createElement('button');
        verifyBtn.textContent = '✅ Подтвердить и создать полис';
        verifyBtn.style.cssText = 'background: #2ecc71; color: white; border: none; padding: 8px 16px; border-radius: 5px; cursor: pointer;';
        verifyBtn.onclick = () => verifyDocuments(app.applicationId, true);

        const rejectBtn = document.createElement('button');
        rejectBtn.textContent = '❌ Отклонить';
        rejectBtn.style.cssText = 'background: #e74c3c; color: white; border: none; padding: 8px 16px; border-radius: 5px; cursor: pointer;';
        rejectBtn.onclick = () => verifyDocuments(app.applicationId, false);

        cardActions.appendChild(verifyBtn);
        cardActions.appendChild(rejectBtn);

        card.appendChild(cardHeader);
        card.appendChild(cardBody);
        card.appendChild(cardActions);

        container.appendChild(card);
    });
}

document.querySelectorAll('.reject-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        console.log('❌ Нажата кнопка отклонения для заявки:', id);
        verifyDocuments(id, false);
    });
});


// Верификация документов
async function verifyDocuments(applicationId, isVerified) {
    const token = localStorage.getItem('token');
    const verifyBtn = document.querySelector(`.verify-btn[data-id="${applicationId}"]`);
    const rejectBtn = document.querySelector(`.reject-btn[data-id="${applicationId}"]`);

    if (verifyBtn) {
        verifyBtn.disabled = true;
        verifyBtn.textContent = '⏳ Обработка...';
    }
    if (rejectBtn) rejectBtn.disabled = true;

    try {
        const response = await fetch(`${API_URL}/documents/verify/${applicationId}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ isVerified })
        });

        const data = await response.json();

        if (data.success) {
            if (isVerified) {
                alert(`✅ ${data.message}\nНомер полиса: ${data.policyNumber}\nEmail отправлен: ${data.client.email}`);
            } else {
                alert(`❌ Документы отклонены`);
            }
            // Обновляем список
            loadDocumentsForVerification();
            loadStats();
        } else {
            alert(`❌ Ошибка: ${data.error}`);
            // Восстанавливаем кнопки
            if (verifyBtn) {
                verifyBtn.disabled = false;
                verifyBtn.textContent = '✅ Подтвердить и создать полис';
            }
            if (rejectBtn) rejectBtn.disabled = false;
        }
    } catch (error) {
        console.error('Ошибка:', error);
        alert('❌ Ошибка соединения с сервером');
        if (verifyBtn) {
            verifyBtn.disabled = false;
            verifyBtn.textContent = '✅ Подтвердить и создать полис';
        }
        if (rejectBtn) rejectBtn.disabled = false;
    }
}

// Отправка email с полисом
async function sendPolicyEmail(applicationId) {
    const token = localStorage.getItem('token');

    try {
        const response = await fetch(`${API_URL}/documents/send-policy/${applicationId}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        const data = await response.json();

    } catch (error) {
    }
}

// Обновите обработчик переключения вкладок
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;

        // Убираем активный класс у всех кнопок
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        // Скрываем все вкладки
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
            content.style.display = 'none'; // Явно скрываем
        });

        // Показываем выбранную вкладку
        let activeTab = null;
        if (tab === 'appointments') {
            activeTab = document.getElementById('tab-appointments');
        } else if (tab === 'search') {
            activeTab = document.getElementById('tab-search');
        } else if (tab === 'documents') {
            activeTab = document.getElementById('tab-documents');
        }

        if (activeTab) {
            activeTab.classList.add('active');
            activeTab.style.display = 'block'; // Явно показываем

            // Загружаем данные для соответствующих вкладок
            if (tab === 'appointments') {
                loadAppointments();
            } else if (tab === 'documents') {
                loadDocumentsForVerification();
            }
        }
    });
});

// Инициализация
document.addEventListener('DOMContentLoaded', async () => {
    // Проверка авторизации
    const isAuth = await checkAdminAuth();
    if (!isAuth) return;

    // Загрузка статистики
    loadStats();

    // Загрузка записей
    loadAppointments();

    // Переключение вкладок
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.dataset.tab;

            // Обновляем активные классы у кнопок
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Обновляем активные классы у контента
            document.querySelectorAll('.tab-content').forEach(content => {
                content.classList.remove('active');
            });

            if (tab === 'appointments') {
                document.getElementById('tab-appointments').classList.add('active');
                loadAppointments();
            } else if (tab === 'search') {
                document.getElementById('tab-search').classList.add('active');
            }

            const container = document.getElementById('documents-container');
            const tabr = document.getElementById('tab-documents');
        });
    });

    // Применение фильтров
    document.getElementById('apply-filters').addEventListener('click', () => {
        const filters = {
            status: document.getElementById('filter-status').value,
            startDate: document.getElementById('filter-start-date').value,
            endDate: document.getElementById('filter-end-date').value,
            search: document.getElementById('filter-search').value
        };
        loadAppointments(filters);
    });

    // Сброс фильтров
    document.getElementById('reset-filters').addEventListener('click', () => {
        document.getElementById('filter-status').value = 'all';
        document.getElementById('filter-start-date').value = '';
        document.getElementById('filter-end-date').value = '';
        document.getElementById('filter-search').value = '';
        loadAppointments();
    });

    // Поиск пользователей
    document.getElementById('search-user-btn').addEventListener('click', () => {
        const query = document.getElementById('search-user-input').value;
        searchUsers(query);
    });

    // Поиск по Enter
    document.getElementById('search-user-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            const query = e.target.value;
            searchUsers(query);
        }
    });

    // Модальное окно
    const modal = document.getElementById('appointment-modal');
    const closeModal = () => modal.style.display = 'none';

    document.querySelector('.close-modal').addEventListener('click', closeModal);
    document.getElementById('close-modal-btn').addEventListener('click', closeModal);

    // Закрытие по клику вне модального окна
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });

    function initTabs() {

        const tabs = document.querySelectorAll('.tab-btn');
        const contents = document.querySelectorAll('.tab-content');

        // Скрываем все вкладки
        contents.forEach(content => {
            content.style.display = 'none';
            content.classList.remove('active');
        });

        // Показываем первую вкладку (appointments)
        const firstTab = document.getElementById('tab-appointments');
        if (firstTab) {
            firstTab.style.display = 'block';
            firstTab.classList.add('active');
        }

        // Добавляем обработчики
        tabs.forEach(btn => {
            btn.addEventListener('click', () => {
                const tabName = btn.dataset.tab;

                // Убираем активность со всех кнопок
                tabs.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                // Скрываем все контенты
                contents.forEach(content => {
                    content.style.display = 'none';
                    content.classList.remove('active');
                });

                // Показываем выбранный контент
                const activeContent = document.getElementById(`tab-${tabName}`);
                if (activeContent) {
                    activeContent.style.display = 'block';
                    activeContent.classList.add('active');

                    // Загружаем данные
                    if (tabName === 'appointments') {
                        loadAppointments();
                    } else if (tabName === 'documents') {
                        loadDocumentsForVerification();
                    }
                }
            });
        });
    }

    document.addEventListener('DOMContentLoaded', () => {
        initTabs();
    });

    // Выход
    document.getElementById('logout-btn').addEventListener('click', logout);
});