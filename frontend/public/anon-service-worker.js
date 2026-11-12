

self.addEventListener('install', () => {
    //
    console.log('service worker installed');
    // Replace an older copy at once: open tabs then stop routing every
    // request through it. The upload handling below is the same in both.
    self.skipWaiting();
});


self.addEventListener('activate', (e) => {
    //
    console.log('service worker activated');

    e.waitUntil(
        self.clients.claim()
    );
});

const UPLOAD_CACHE = "local-uploads";

const ANON_URL_PREFIX = `https://oncyber.io/${UPLOAD_CACHE}/`;


/**
 * @type { Cache }
 */
let anonCache = null;

async function getFromCache(request) {

    //
    if (anonCache == null) {
        //
        anonCache = await caches.open(UPLOAD_CACHE)
    }

    return anonCache.match(request);
}


// This worker exists for one thing: Studio keeps an anonymous visitor's
// uploads in Cache Storage under made-up `https://oncyber.io/local-uploads/…`
// URLs (utils/anon/FileUploadCache.ts), and answers requests for them here.
// Every other request is left alone: without `respondWith` the browser sends
// it to the network itself, with its normal caching, priority and preloads.
self.addEventListener('fetch', (e) => {
    if (!e.request.url.startsWith(ANON_URL_PREFIX)) return;

    e.respondWith(
        getFromCache(e.request.url)
    );
});

