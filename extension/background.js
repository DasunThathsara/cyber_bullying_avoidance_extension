console.log("Shieldy Background Script Loaded. Monitoring navigation.");

/**
 * @param {string} text
 * @returns {Promise<string|false>} 
 */
async function isBadText(text) {
  if (!text || !text.trim()) return false;
  
  const searchPatterns = [
      /(?:\?|&)q=([^&]+)/,
      /(?:\?|&)query=([^&]+)/,
      /(?:\?|&)search_query=([^&]+)/,
      /(?:\?|&)search=([^&]+)/,
      /(?:\?|&)keyword=([^&]+)/,
      /(?:\?|&)term=([^&]+)/
  ];

  let searchText = text;
  for (const pattern of searchPatterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
          searchText = match[1].replace(/\+/g, ' ');
          break;
      }
  }

  const textsToTest = [...new Set([text, searchText])].filter(t => t.trim());

  for (const txt of textsToTest) {
      try {
          const localRes = await fetch("http://127.0.0.1:8001/check/local/", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ sentence: txt }),
          });
          const localData = await localRes.json();
          if (localData.result === "BAD") return txt; // Return the bad text found
      } catch (err) {
          console.error("Local check API error:", err);
      }
      try {
          const llmRes = await fetch("http://127.0.0.1:8001/check/llm/", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ sentence: txt }),
          });
          const llmData = await llmRes.json();
          if (llmData.result === "BAD") return txt; // Return the bad text found
      } catch (err) {
          console.error("LLM check API error:", err);
      }
  }
  return false; 
}

/**
 * @param {number} tabId 
 * @param {string} blockedText
 */
async function logAndBlock(tabId, blockedText) {
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
      } catch (logError) {
          console.error("Logging API error:", logError);
      }
    }
  } catch (e) {
      console.error("Error getting child username for logging:", e);
  }

  chrome.tabs.update(tabId, {
    url: chrome.runtime.getURL("blocked.html")
  });
}

chrome.webNavigation.onBeforeNavigate.addListener(async (details) => {
  if (details.frameId !== 0) {
    return;
  }

  try {
    const decodedUrl = decodeURIComponent(details.url);
    const badTextFound = await isBadText(decodedUrl);

    if (badTextFound) {
      console.log(`Blocking navigation to ${details.url} due to term: "${badTextFound}"`);
      await logAndBlock(details.tabId, badTextFound);
    }
  } catch (e) {
    console.error("Error processing navigation:", e);
  }
}, {
  url: [{ schemes: ["http", "https"] }]
});