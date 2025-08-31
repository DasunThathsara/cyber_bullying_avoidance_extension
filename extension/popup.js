document.addEventListener('DOMContentLoaded', () => {
    const loginView = document.getElementById('login-view');
    const statusView = document.getElementById('status-view');
    const statusMainView = document.getElementById('status-main-view');
    const logoutConfirmView = document.getElementById('logout-confirm-view');
    
    const statusMessage = document.getElementById('status-message');
    const loginBtn = document.getElementById('login-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const confirmLogoutBtn = document.getElementById('confirm-logout-btn');
    const cancelLogoutBtn = document.getElementById('cancel-logout-btn');

    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const logoutPasswordInput = document.getElementById('logout-password');

    const loginError = document.getElementById('login-error');
    const logoutError = document.getElementById('logout-error');

    const showLoginView = () => {
        loginView.style.display = 'block';
        statusView.style.display = 'none';
        statusMainView.style.display = 'block';
        logoutConfirmView.style.display = 'none';
        usernameInput.value = '';
        passwordInput.value = '';
        logoutPasswordInput.value = '';
        loginError.textContent = '';
        logoutError.textContent = '';
    };

    const showStatusView = (username) => {
        statusMessage.textContent = `Logged in as: ${username}`;
        statusView.style.display = 'block';
        statusMainView.style.display = 'block';
        loginView.style.display = 'none';
        logoutConfirmView.style.display = 'none';
        logoutPasswordInput.value = '';
        logoutError.textContent = '';
    };

    chrome.storage.local.get(['childUsername'], (result) => {
        if (result.childUsername) {
            showStatusView(result.childUsername);
        } else {
            showLoginView();
        }
    });

    loginBtn.addEventListener('click', async () => {
        const username = usernameInput.value.trim();
        const password = passwordInput.value;

        if (!username || !password) {
            loginError.textContent = 'Username and password are required.';
            return;
        }

        loginError.textContent = '';
        
        const formData = new URLSearchParams();
        formData.append('username', username);
        formData.append('password', password);

        try {
            const response = await fetch("http://127.0.0.1:8000/token", {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                body: formData,
            });

            if (response.ok) {
                // Login successful
                const data = await response.json();
                if (data.access_token) {
                    chrome.storage.local.set({ childUsername: username, childPassword: password }, () => {
                        showStatusView(username);
                    });
                } else {
                     loginError.textContent = "Login failed: No access token received.";
                }
            } else {
                // Login failed (e.g., 401 Unauthorized)
                loginError.textContent = "Invalid username or password.";
            }
        } catch (error) {
            // Network or other errors
            console.error("Login request failed:", error);
            loginError.textContent = "Could not connect to the server.";
        }
    });

    logoutBtn.addEventListener('click', () => {
        statusMainView.style.display = 'none';
        logoutConfirmView.style.display = 'block';
    });

    cancelLogoutBtn.addEventListener('click', () => {
        statusMainView.style.display = 'block';
        logoutConfirmView.style.display = 'none';
        logoutPasswordInput.value = '';
        logoutError.textContent = '';
    });

    confirmLogoutBtn.addEventListener('click', () => {
        const enteredPassword = logoutPasswordInput.value;
        if (!enteredPassword) {
            logoutError.textContent = 'Password is required.';
            return;
        }

        chrome.storage.local.get(['childPassword'], (result) => {
            if (result.childPassword && result.childPassword === enteredPassword) {
                chrome.storage.local.remove(['childUsername', 'childPassword'], () => {
                    showLoginView();
                });
            } else {
                logoutError.textContent = 'Incorrect password. Please try again.';
                logoutPasswordInput.value = '';
            }
        });
    });
});