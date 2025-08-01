document.addEventListener('DOMContentLoaded', () => {
    const loginView = document.getElementById('login-view');
    const statusView = document.getElementById('status-view');
    const statusMessage = document.getElementById('status-message');
    const loginBtn = document.getElementById('login-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const loginError = document.getElementById('login-error');

    const showLoginView = () => {
        loginView.style.display = 'block';
        statusView.style.display = 'none';
        usernameInput.value = '';
        passwordInput.value = '';
        loginError.textContent = '';
    };

    const showStatusView = (username) => {
        statusMessage.textContent = `Logged in as: ${username}`;
        statusView.style.display = 'block';
        loginView.style.display = 'none';
    };

    chrome.storage.local.get(['childUsername'], (result) => {
        if (result.childUsername) {
            showStatusView(result.childUsername);
        } else {
            showLoginView();
        }
    });

    loginBtn.addEventListener('click', () => {
        const username = usernameInput.value.trim();
        const password = passwordInput.value; 

        if (username && password) {
            loginError.textContent = '';
            chrome.storage.local.set({ childUsername: username }, () => {
                showStatusView(username);
            });
        } else {
            loginError.textContent = 'Username and password are required.';
        }
    });

    logoutBtn.addEventListener('click', () => {
        chrome.storage.local.remove(['childUsername'], () => {
            showLoginView();
        });
    });
});