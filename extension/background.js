// This script checks searches FROM THE URL BAR and redirects to a blocked page if necessary.
console.log("Parental Control Background Script v3.0 (LLM-powered) Loaded.");

async function checkSearchQueryWithLLM(query) {
    if (!query) return false;
    try {
        // Use the /check/llm/ endpoint for the final check
        const response = await fetch('http://127.0.0.1:8000/check/llm/', { // <-- CORRECT URL HERE
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sentence: query }),
        });
        const data = await response.json();
        return data.result === 'BAD';
    } catch (error) {
        console.error('Parental Control API Error:', error);
        return false;
    }
}

// (The rest of the file remains the same)
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.url) {
        try {
            const url = new URL(changeInfo.url);
            let searchQuery = null;
            if (url.hostname.includes('google.') || url.hostname.includes('bing.com') || url.hostname.includes('duckduckgo.com') || url.hostname.includes('youtube.com')) {
                searchQuery = url.searchParams.get('q') || url.searchParams.get('search_query');
            } else if (url.hostname.includes('yahoo.com')) {
                searchQuery = url.searchParams.get('p');
            }
            if (searchQuery) {
                const isBad = await checkSearchQueryWithLLM(searchQuery);
                if (isBad) {
                    chrome.tabs.update(tabId, { url: chrome.runtime.getURL('blocked.html') });
                }
            }
        } catch (error) {}
    }
});