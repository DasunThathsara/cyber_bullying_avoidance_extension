// This script checks searches from the browser's main URL bar
console.log("Parental Control Background Script Loaded.");

async function checkSearchQuery(query) {
    if (!query) return false;
    try {
        const response = await fetch('http://127.0.0.1:8000/check-sentence/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sentence: query }),
        });
        const data = await response.json();
        return data.result === 'BAD';
    } catch (error) {
        console.error('Parental Control API Error:', error);
        return false; // Fail-safe
    }
}

// Listen for when a tab is updated (e.g., navigation)
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    // We only care when the URL changes, to avoid running on every small update
    if (changeInfo.url) {
        try {
            const url = new URL(changeInfo.url);
            let searchQuery = null;

            // Extract search query from common search engines (add more if needed)
            if (url.hostname.includes('google.') || url.hostname.includes('bing.com') || url.hostname.includes('duckduckgo.com') || url.hostname.includes('youtube.com')) {
                searchQuery = url.searchParams.get('q') || url.searchParams.get('search_query');
            } else if (url.hostname.includes('yahoo.com')) {
                searchQuery = url.searchParams.get('p');
            }

            if (searchQuery) {
                console.log(`Detected search query: ${searchQuery}`);
                const isBad = await checkSearchQuery(searchQuery);
                if (isBad) {
                    console.log(`Blocking bad search: ${searchQuery}`);
                    // Redirect the tab to our local "blocked" page
                    chrome.tabs.update(tabId, {
                        url: chrome.runtime.getURL('blocked.html')
                    });
                }
            }
        } catch (error) {
            // This can happen for non-standard URLs like "chrome://...". Just ignore them.
        }
    }
});