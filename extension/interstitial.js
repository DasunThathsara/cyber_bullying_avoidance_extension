async function checkUrl() {
    const params = new URLSearchParams(window.location.search);
    const originalUrlString = params.get('url');

    if (!originalUrlString) {
        document.getElementById('title').innerText = 'Error';
        document.getElementById('message').innerText = 'Could not find the original destination URL.';
        return;
    }

    const originalUrl = new URL(originalUrlString);
    const searchQuery = originalUrl.searchParams.get('q') || originalUrl.searchParams.get('search_query') || originalUrl.searchParams.get('p');

    if (!searchQuery) {
        window.location.replace(originalUrlString);
        return;
    }

    try {
        const response = await fetch('http://127.0.0.1:8000/check-sentence/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sentence: searchQuery }),
        });
        const data = await response.json();

        if (data.result === 'BAD') {
            document.body.className = 'state-blocked';
            document.getElementById('title').innerText = 'Content Blocked';
            document.getElementById('message').innerText = 'This search was blocked because it contains inappropriate language.';
        } else {
            window.location.replace(originalUrlString);
        }
    } catch (error) {
        console.error('Parental Control API Error:', error);
        window.location.replace(originalUrlString);
    }
}

checkUrl();
