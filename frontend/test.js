document.addEventListener('DOMContentLoaded', function () {

    const API_URL = 'http://localhost:3001/api';
    const addbtn = document.querySelector('.btn')

    // Функция добавления пользователя
    async function addUser() {
        const dotaname = document.getElementById('dota').value;
        const csname = document.getElementById('cs').value;

        if (!dotaname || !csname) {
            alert('Введите имя!');
            return;
        }

        try {
            // Отправляем POST запрос на сервер
            const response = await fetch(`${API_URL}/users`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ dotaname: dotaname, csname: csname })
            });

            const data = await response.json();
            console.log(data)

            if (data.success) {
                document.getElementById('result').innerHTML =
                    `<span style="color:green">✅ ${data.message}</span>`;
                document.getElementById('dota').value = '';
                document.getElementById('cs').value = ''; // Очищаем поле
                loadUsers(); // Обновляем список
            } else {
                document.getElementById('result').innerHTML =
                    `<span style="color:red">❌ ${data.error}</span>`;
            }
        } catch (error) {
            document.getElementById('result').innerHTML =
                `<span style="color:red">❌ Ошибка соединения: ${error}</span>`;
        }
    }

    addbtn.addEventListener('click', addUser)

    // Функция загрузки списка пользователей
    async function loadUsers() {
        try {
            const response = await fetch(`${API_URL}/users`);
            const data = await response.json();

            if (data.success && data.users) {
                let html = '';
                data.users.forEach(user => {
                    html += `<div class="user-item">
                            DOTA: ${user.dota}   |   CS: ${user.cs}
                        </div>`;
                });
                document.getElementById('userList').innerHTML = html || 'Нет пользователей';
            }
        } catch (error) {
            document.getElementById('userList').innerHTML = 'Ошибка загрузки';
        }
    }

    // Загружаем список при старте
    loadUsers();

})