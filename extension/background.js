console.log("Shieldy Background Script Loaded. Monitoring navigation.");

function extractSearchTerm(url) {
  const searchPatterns = [
      /(?:\?|&)q=([^&]+)/,
      /(?:\?|&)query=([^&]+)/,
      /(?:\?|&)search_query=([^&]+)/,
      /(?:\?|&)search=([^&]+)/,
      /(?:\?|&)keyword=([^&]+)/,
      /(?:\?|&)term=([^&]+)/
  ];

  for (const pattern of searchPatterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
          return decodeURIComponent(match[1].replace(/\+/g, ' ')).trim();
      }
  }

  return null;
}

async function isBadText(sentence) {
  if (!sentence || !sentence.trim()) return false;
  
  try {
      const localRes = await fetch("http://127.0.0.1:8001/check/local/", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sentence: sentence }),
      });
      const localData = await localRes.json();
      if (localData.result === "BAD") return true;
  } catch (err) {
      console.error("Local check API error:", err);
  }
  
  try {
      const llmRes = await fetch("http://127.0.0.1:8001/check/llm/", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sentence: sentence }),
      });
      const llmData = await llmRes.json();
      if (llmData.result === "BAD") return true;
  } catch (err) {
      console.error("LLM check API error:", err);
  }

  return false;
}

async function logAndBlock(tabId, blockedWord) {
  try {
    const data = await chrome.storage.local.get(['childUsername']);
    const childUsername = data.childUsername;
    if (childUsername) {
      try {
        await fetch("http://127.0.0.1:8000/searches/log", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ search_query: blockedWord, child_username: childUsername }),
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
    const searchTerm = extractSearchTerm(details.url);

    if (searchTerm) {
      if (await isBadText(searchTerm)) {
        console.log(`Blocking navigation due to search term: "${searchTerm}"`);
        await logAndBlock(details.tabId, searchTerm);
      }
    }
  } catch (e) {
    console.error("Error processing navigation:", e);
  }
}, {
  url: [{ schemes: ["http", "https"] }]
});