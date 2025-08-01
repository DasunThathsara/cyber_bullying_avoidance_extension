console.log("Parental Control Content Script v3.9 Loaded.");

function debounce(fn, ms) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

function clearText(el) {
  if ('value' in el) {
    el.value = '';
  } else if (el.isContentEditable) {
    el.textContent = '';
  }
}

async function isBadText(text) {
  if (!text.trim()) return false;
  
  try {
    const localRes = await fetch("http://127.0.0.1:8001/check/local/", {
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
    const llmRes = await fetch("http://127.0.0.1:8001/check/llm/", {
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

async function logAndBlock(blockedText, elementToClear) {
    const data = await chrome.storage.local.get(['childUsername']);
    const childUsername = data.childUsername;

    if (elementToClear) {
        clearText(elementToClear);
    }
    
    if (childUsername) {
        try {
            await fetch("http://127.0.0.1:8000/searches/log", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    search_query: blockedText,
                    child_username: childUsername
                }),
            });
        } catch (logError) {
            console.error("Failed to log blocked search:", logError);
        }
    } else {
        console.log("No child logged in. Blocking without logging.");
    }
    
    window.location.href = chrome.runtime.getURL("blocked.html");
}

function attachListeners() {
  const inputs = document.querySelectorAll(
    'textarea, input[type="text"], [contenteditable="true"]'
  );

  inputs.forEach((el) => {
    if (el.dataset.pcAttached) return;
    el.dataset.pcAttached = "true";

    const debouncedCheck = debounce(async () => {
      const txt = el.value || el.innerText || "";
      if (await isBadText(txt)) {
        await logAndBlock(txt, el);
      }
    }, 400);
    el.addEventListener("input", debouncedCheck);

    el.addEventListener("keydown", async (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        const txt = el.value || el.innerText || "";
        if (await isBadText(txt)) {
          e.preventDefault();
          e.stopImmediatePropagation();
          await logAndBlock(txt, el);
        }
      }
    }, true); 
  });
}

new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    if (mutation.addedNodes.length) {
      attachListeners();
    }
  });
}).observe(document.body, {
  childList: true,
  subtree: true,
});

attachListeners();