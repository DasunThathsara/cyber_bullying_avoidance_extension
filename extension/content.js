console.log("Parental Control Script Loaded with Visual Feedback.");

// --- 1. Inject CSS for visual feedback ---
const style = document.createElement('style');
style.textContent = `
  .parental-control-blocked-input {
    border: 3px solid red !important;
    box-shadow: 0 0 5px red !important;
  }
`;
document.head.appendChild(style);


// --- 2. The Core Logic (with minor changes to handle element state) ---
const badInputState = {
  element: null,
  isBad: false,
};

function debounce(func, delay) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), delay);
    };
}

async function checkTextWithAPI(element) {
    const text = element.value || element.innerText;

    if (badInputState.element) {
        badInputState.element.classList.remove('parental-control-blocked-input');
    }

    if (!text || text.trim().length < 3) {
        badInputState.isBad = false;
        badInputState.element = null;
        updateButtonStates();
        return;
    }

    try {
        const response = await fetch('http://127.0.0.1:8000/check-sentence/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sentence: text }),
        });
        const data = await response.json();

        badInputState.isBad = (data.result === 'BAD');
        badInputState.element = element;

        if (badInputState.isBad) {
            element.classList.add('parental-control-blocked-input');
        } else {
            element.classList.remove('parental-control-blocked-input');
        }

        updateButtonStates();

    } catch (error) {
        console.error('Parental Control API Error:', error);
        badInputState.isBad = false; 
        updateButtonStates();
    }
}

function updateButtonStates() {
    const buttons = document.querySelectorAll('button, input[type="submit"], [role="button"]');
    const sendButtonSelectors = 'button, input[type="submit"], [role="button"], [data-icon="send"]';
    const sendKeywords = ['send', 'post', 'reply', 'tweet', 'comment', 'save', 'share'];

    document.querySelectorAll(sendButtonSelectors).forEach(button => {
        const buttonText = (button.innerText || button.value || "").toLowerCase();
        const isSendButton = sendKeywords.some(keyword => buttonText.includes(keyword)) || button.matches('[data-icon="send"]');

        if (isSendButton) {
            button.disabled = badInputState.isBad;
            button.style.opacity = badInputState.isBad ? '0.5' : '1';
            button.style.cursor = badInputState.isBad ? 'not-allowed' : 'pointer';
        }
    });
}

const debouncedCheck = debounce(checkTextWithAPI, 500);

function addListeners(element) {
    element.addEventListener('input', (event) => {
        debouncedCheck(event.target);
    });

    element.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' && badInputState.isBad && event.target === badInputState.element && !event.shiftKey) {
            console.log("Parental Control: 'Enter' key blocked inside webpage.");
            event.preventDefault(); 
        }
    });
}


// --- 3. Attach Listeners to All Fields ---
const observer = new MutationObserver(mutations => {
    mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
            if (node.nodeType === 1) { 
                const fields = node.querySelectorAll('textarea, input[type="text"], [contenteditable="true"]');
                fields.forEach(addListeners);

                if (node.matches('textarea, input[type="text"], [contenteditable="true"]')) {
                    addListeners(node);
                }
            }
        });
    });
});

observer.observe(document.body, { childList: true, subtree: true });

document.querySelectorAll('textarea, input[type="text"], [contenteditable="true"]').forEach(addListeners);