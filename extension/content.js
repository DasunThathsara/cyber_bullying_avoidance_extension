console.log("Parental Control Content Script v3.7 Loaded.");

function debounce(fn, ms) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

async function isBadText(text) {
  if (!text.trim()) return false;
  try {
    const localRes = await fetch("http://127.0.0.1:8000/check/local/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sentence: text }),
    });
    const localData = await localRes.json();
    if (localData.result === "BAD") return true;
  } catch (err) {
    console.error("Local model error:", err);
  }
  
  try {
    const llmRes = await fetch("http://127.0.0.1:8000/check/llm/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sentence: text }),
    });
    const llmData = await llmRes.json();
    if (llmData.result === "BAD") return true;
  } catch (err) {
    console.error("LLM model error:", err);
  }
  return false;
}

function findSendButton(input) {
  let parent = input.parentElement;
  while (parent) {
    const btn = parent.querySelector(sendSelectors);
    if (btn) return btn;
    parent = parent.parentElement;
  }
  return null;
}

async function handleSendClick(event) {
  event.preventDefault();
  event.stopImmediatePropagation();
  const btn = event.currentTarget;
  const active = document.activeElement;
  const text = active.value || active.innerText || "";
  if (!text) return;

  const orig = btn.innerHTML;
  btn.textContent = "Checking...";
  btn.disabled = true;

  if (await isBadText(text)) {
    window.location.href = chrome.runtime.getURL("blocked.html");
  } else {
    btn.disabled = false;
    btn.innerHTML = orig;
    btn.click();
  }
}

function attachListeners() {
  const inputs = document.querySelectorAll(
    'textarea, input[type="text"], [contenteditable="true"]'
  );

  inputs.forEach((el) => {
    if (!el.dataset.pcInput) {
      const deb = debounce(async () => {
        const txt = el.value || el.innerText || "";
        if (await isBadText(txt)) {
          window.location.href = chrome.runtime.getURL("blocked.html");
        }
      }, 300);
      el.addEventListener("input", deb);
      el.dataset.pcInput = "1";
    }
  });

  const sendSelectors = [
    'button[type="submit"]',
    '[data-icon="send"]',
    'button[aria-label="Send"]',
    'div[role="button"][aria-label*="Send"]',
  ].join(",");
  document.querySelectorAll(sendSelectors).forEach((btn) => {
    if (!btn.dataset.pcBtn) {
      btn.addEventListener("click", handleSendClick, true);
      btn.dataset.pcBtn = "1";
    }
  });

  inputs.forEach((el) => {
    if (!el.dataset.pcKey) {
      el.addEventListener("keydown", async (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          const txt = el.value || el.innerText || "";
          if (await isBadText(txt)) {
            window.location.href = chrome.runtime.getURL("blocked.html");
          } else {
            const sendBtn = findSendButton(el);
            if (sendBtn) {
              sendBtn.click();
            } else {
              el.dispatchEvent(
                new KeyboardEvent("keydown", { key: "Enter", code: "Enter", bubbles: true })
              );
            }
          }
        }
      });
      el.dataset.pcKey = "1";
    }
  });
}

new MutationObserver(attachListeners).observe(document.body, {
  childList: true,
  subtree: true,
});
attachListeners();