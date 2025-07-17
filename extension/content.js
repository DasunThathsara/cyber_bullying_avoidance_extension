// This file is responsible for blocking text within ANY webpage
console.log("Parental Control Script Loaded.");

let isTextBad = false;

// Debounce function to prevent API calls on every keystroke
function debounce(func, delay) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), delay);
    };
}

// Function to call your local API
async function checkTextWithAPI(text) {
    if (!text || text.trim().length < 3) {
        isTextBad = false;
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
        isTextBad = (data.result === 'BAD');
        updateButtonStates();
    } catch (error) {
        console.error('Parental Control API Error:', error);
        isTextBad = false; // Fail-safe: if the API is down, don't block.
        updateButtonStates();
    }
}

// Find and disable/enable relevant buttons
function updateButtonStates() {
    const buttons = document.querySelectorAll('button, input[type="submit"], [role="button"]');
    const sendKeywords = ['send', 'post', 'reply', 'tweet', 'comment', 'save', 'share'];
    buttons.forEach(button => {
        const buttonText = (button.innerText || button.value || "").toLowerCase();
        const isSendButton = sendKeywords.some(keyword => buttonText.includes(keyword));
        if (isSendButton) {
            button.disabled = isTextBad;
            button.style.opacity = isTextBad ? '0.5' : '1';
            button.style.cursor = isTextBad ? 'not-allowed' : 'pointer';
        }
    });
}

const debouncedCheck = debounce(checkTextWithAPI, 500);

function addListeners(element) {
    // Listen for text being typed or pasted
    element.addEventListener('input', (event) => {
        debouncedCheck(event.target.value || event.target.innerText);
    });

    // Listen for the 'Enter' key
    element.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' && isTextBad && !event.shiftKey) {
            console.log("Parental Control: 'Enter' key blocked inside webpage.");
            event.preventDefault(); // Block the Enter key action
        }
    });
}

// Use a MutationObserver to detect new input fields loaded dynamically
const observer = new MutationObserver(mutations => {
    mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
            if (node.nodeType === 1) { // Check if it's an element
                if (node.matches('textarea, input[type="text"], [contenteditable="true"]')) {
                    addListeners(node);
                }
                node.querySelectorAll('textarea, input[type="text"], [contenteditable="true"]').forEach(addListeners);
            }
        });
    });
});

// Start observing and also capture any initial elements
observer.observe(document.body, { childList: true, subtree: true });
document.querySelectorAll('textarea, input[type="text"], [contenteditable="true"]').forEach(addListeners);