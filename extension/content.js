// content.js
console.log("Parental Control Content Script v3.9 Loaded.");

function debounce(fn, ms) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

function clearText(el) {
  try {
    if ('value' in el) el.value = '';
    if (el.isContentEditable) {
      el.innerHTML = '';
      el.textContent = '';
    }
  } catch (e) {}
}

async function clearLocalSessionDrafts() {
  try {
    const substrs = ['draft', 'compose', 'pending', 'input', 'message', 'conversation', 'chat', 'draft_message', 'text'];
    for (const k of Object.keys(localStorage || {})) {
      try {
        const lk = k.toLowerCase();
        if (substrs.some(s => lk.includes(s))) localStorage.removeItem(k);
      } catch (e) {}
    }
    for (const k of Object.keys(sessionStorage || {})) {
      try {
        const lk = k.toLowerCase();
        if (substrs.some(s => lk.includes(s))) sessionStorage.removeItem(k);
      } catch (e) {}
    }
  } catch (e) {}
}

async function clearIndexedDbDrafts() {
  try {
    if (!indexedDB || !indexedDB.databases) return;
    const substrs = ['draft', 'compose', 'pending', 'input', 'message', 'conversation', 'chat', 'wa', 'whatsapp'];
    const dbs = await indexedDB.databases();
    for (const dbInfo of dbs || []) {
      const name = dbInfo && dbInfo.name;
      if (!name) continue;
      try {
        const openReq = indexedDB.open(name);
        const db = await new Promise(res => {
          openReq.onsuccess = () => res(openReq.result);
          openReq.onerror = () => res(null);
          openReq.onblocked = () => res(null);
        });
        if (!db) continue;
        const stores = Array.from(db.objectStoreNames || []);
        const toClear = stores.filter(s => substrs.some(sub => s.toLowerCase().includes(sub)));
        if (toClear.length) {
          const tx = db.transaction(toClear, 'readwrite');
          for (const s of toClear) {
            try { tx.objectStore(s).clear(); } catch (e) {}
          }
          await new Promise(res => { tx.oncomplete = res; tx.onerror = res; tx.onabort = res; });
        }
        try { db.close(); } catch (e) {}
      } catch (e) {}
    }
  } catch (e) {}
}

function simulateDelete(el) {
  try {
    if (el.focus) el.focus();
    try { document.execCommand('selectAll'); document.execCommand('delete'); } catch (e) {}
    try {
      const before = new InputEvent('beforeinput', { bubbles: true, cancelable: true, inputType: 'deleteContentBackward', data: null });
      const inputEv = new InputEvent('input', { bubbles: true, inputType: 'deleteContentBackward', data: null });
      el.dispatchEvent(before);
      el.dispatchEvent(inputEv);
    } catch (e) {}
    try {
      el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', code: 'Backspace', bubbles: true }));
      el.dispatchEvent(new KeyboardEvent('keyup', { key: 'Backspace', code: 'Backspace', bubbles: true }));
    } catch (e) {}
  } catch (e) {}
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
  } catch (err) {}
  try {
    const llmRes = await fetch("http://127.0.0.1:8001/check/llm/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sentence: text }),
    });
    const llmData = await llmRes.json();
    if (llmData.result === "BAD") return true;
  } catch (err) {}
  return false;
}

async function logAndBlock(blockedText) {
  try {
    const data = await chrome.storage.local.get(['childUsername']);
    const childUsername = data.childUsername;
    if (childUsername) {
      try {
        await fetch("http://127.0.0.1:8000/searches/log", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ search_query: blockedText, child_username: childUsername }),
        });
      } catch (logError) {}
    }
  } catch (e) {}
  window.location.href = chrome.runtime.getURL("blocked.html");
}

async function handleBadTextDetection(txt, el) {
  try {
    clearText(el);
    simulateDelete(el);
    await clearLocalSessionDrafts();
    await clearIndexedDbDrafts();
    try { el.dispatchEvent(new Event('input', { bubbles: true })); } catch (e) {}
    try { el.dispatchEvent(new Event('change', { bubbles: true })); } catch (e) {}
    if (el.form) try { el.form.reset(); } catch (e) {}
    await new Promise(r => setTimeout(r, 200));
  } catch (e) {}
  await logAndBlock(txt);
}

function attachListeners() {
  const inputs = document.querySelectorAll('textarea, input[type="text"], input[type="search"], [contenteditable="true"]');
  inputs.forEach((el) => {
    try {
      if (el.dataset.pcAttached) return;
      el.dataset.pcAttached = "true";
      const debouncedCheck = debounce(async () => {
        const txt = el.value || el.innerText || "";
        if (txt.trim() && await isBadText(txt)) {
          await handleBadTextDetection(txt, el);
        }
      }, 400);
      el.addEventListener("input", debouncedCheck);
      el.addEventListener("keydown", async (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          const txt = el.value || el.innerText || "";
          if (txt.trim() && await isBadText(txt)) {
            e.preventDefault();
            e.stopImmediatePropagation();
            await handleBadTextDetection(txt, el);
          }
        }
      }, true);
    } catch (e) {}
  });
}

new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    if (mutation.addedNodes.length) {
      attachListeners();
    }
  });
}).observe(document.body, { childList: true, subtree: true });

attachListeners();
