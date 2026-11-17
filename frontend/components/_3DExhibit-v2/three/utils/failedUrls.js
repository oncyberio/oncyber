// @ts-check

/**
 * Media URLs that just failed to load. A space can use the same dead link for
 * many artworks and detail levels; without this, each one asked for it again
 * (dozens of requests per visit for old proxy and gateway links).
 */
export class FailedUrls {

    /** @param {{ ttlMs?: number, now?: () => number }} [options] */
    constructor({ ttlMs = 5 * 60 * 1000, now = () => Date.now() } = {}) {

        this.ttlMs = ttlMs

        this.now = now

        /** @type { Map<string, number> } */
        this.failures = new Map()
    }

    /** @param {string} url */
    add(url) {

        this.failures.set(url, this.now())
    }

    /** @param {string} url */
    has(url) {

        const at = this.failures.get(url)

        if (at === undefined) return false

        if (this.now() - at < this.ttlMs) return true

        this.failures.delete(url)

        return false
    }
}

export const FAILED_MEDIA_URLS = new FailedUrls()
