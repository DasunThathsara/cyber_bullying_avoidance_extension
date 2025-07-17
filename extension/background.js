console.log("Parental Control Background Script v2 Loaded.");

chrome.webNavigation.onBeforeNavigate.addListener((details) => {
    if (details.frameId !== 0) {
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
        const interstitialUrl = chrome.runtime.getURL(
            `interstitial.html?url=${encodeURIComponent(details.url)}`
        );

        chrome.tabs.update(details.tabId, { url: interstitialUrl });
    }
}, {
    url: [{ hostContains: 'google' }, { hostContains: 'bing' }, { hostContains: 'yahoo' }, { hostContains: 'duckduckgo' }, { hostContains: 'youtube' }]
});