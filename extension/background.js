console.log("Parental Control Background Script v2.1 (with anti-loop fix) Loaded.");

chrome.webNavigation.onBeforeNavigate.addListener(async (details) => {
    if (details.frameId !== 0) {
        return;
    }

    const tab = await chrome.tabs.get(details.tabId);

    const interstitialPageUrl = chrome.runtime.getURL('interstitial.html');
    if (tab.url && tab.url.startsWith(interstitialPageUrl)) {
        console.log("Navigation is from interstitial page, allowing.");
        return;
    }


    const url = new URL(details.url);
    let searchQuery = null;

    if (url.hostname.includes('google.') || url.hostname.includes('bing.com') || url.hostname.includes('duckduckgo.com') || url.hostname.includes('youtube.com')) {
        searchQuery = url.searchParams.get('q') || url.searchParams.get('search_query');
    } else if (url.hostname.includes('yahoo.com')) {
        searchQuery = url.searchParams.get('p');
    }

    if (searchQuery) {
        console.log(`Intercepting search for: ${searchQuery}`);
        const newUrl = chrome.runtime.getURL(
            `interstitial.html?url=${encodeURIComponent(details.url)}`
        );

        chrome.tabs.update(details.tabId, { url: newUrl });
    }
}, {
    url: [{ hostContains: 'google' }, { hostContains: 'bing' }, { hostContains: 'yahoo' }, { hostContains: 'duckduckgo' }, { hostContains: 'youtube' }]
});