console.log("Parental Control Content Script v3.4 (Aggressive Redirect) Loaded.");

const style = document.createElement('style');
style.textContent = `
  .pc-checking-button { cursor: wait !important; }
`;
document.head.appendChild(style);


const debouncedLocalCheck = debounce(checkTextWithLocalModel, 300);

async function checkTextWithLocalModel(element) {
    if (!element) return;
    const text = element.value || element.innerText;
    if (!text.trim()) return;

    try {
        const response = await fetch('http://127.0.0.1:8000/check/local/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sentence: text }),
        });
        const data = await response.json();

        if (data.result === 'BAD') {
            console.log("Real-time check failed. Redirecting to blocked page.");
            window.location.href = chrome.runtime.getURL('blocked.html');
        }
    } catch (e) {
        console.error("Local model API error:", e);
    }
}

async function checkTextWithLLM(text) {
    try {
        const response = await fetch('http://127.0.0.1:8000/check/llm/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sentence: text }),
        });
        return await response.json();
    } catch (e) {
        console.error("LLM API error:", e);
        return { result: "NOT BAD" };
    }
}


async function handleSendClick(event) {
    event.preventDefault();
    event.stopImmediatePropagation();

    const button = event.currentTarget;
    const inputElement = document.activeElement;

    if (!inputElement || (inputElement.tagName !== 'INPUT' && inputElement.tagName !== 'TEXTAREA' && !inputElement.isContentEditable)) {
        return;
    }

    const text = inputElement.value || inputElement.innerText;
    if (!text) return;

    const originalButtonText = button.innerHTML;
    button.textContent = 'Checking...';
    button.classList.add('pc-checking-button');
    button.disabled = true;

    const llmResult = await checkTextWithLLM(text);

    if (llmResult.result === 'BAD') {
        button.textContent = 'Blocked';
    } else {
        button.disabled = false;
        button.innerHTML = originalButtonText;
        button.classList.remove('pc-checking-button');
        button.removeEventListener('click', handleSendClick, true);
        button.click();
        button.addEventListener('click', handleSendClick, true);
    }
}


function debounce(func, delay) {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), delay);
    };
}

function attachListenersToPage() {
    const sendButtonSelectors = 'button[type="submit"], [data-icon="send"], button[aria-label="Send"], div[role="button"][aria-label*="Send"]';

    document.querySelectorAll('textarea, input[type="text"], [contenteditable="true"]').forEach(input => {
        if (!input.dataset.pcListenerAttached) {
            input.addEventListener('input', () => debouncedLocalCheck(input));
            input.dataset.pcListenerAttached = 'true';
        }
    });

    document.querySelectorAll(sendButtonSelectors).forEach(button => {
        if (!button.dataset.pcClickListenerAttached) {
            button.addEventListener('click', handleSendClick, true);
            button.dataset.pcClickListenerAttached = 'true';
        }
    });
}

const observer = new MutationObserver(() => {
    attachListenersToPage();
});
observer.observe(document.body, { childList: true, subtree: true });

attachListenersToPage();