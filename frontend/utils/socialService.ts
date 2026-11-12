/**
 * The social service (parties, presence and contact policy) is a separate
 * backend. These helpers build its internal URLs and service credentials;
 * neither is ever taken from browser input.
 */
export function socialServiceHeaders() {
    return {
        "content-type": "application/json",
        authorization: `Bearer ${process.env.SOCIAL_SERVICE_SECRET || ""}`,
    };
}

export function socialServiceUrl(path: string) {
    return `${
        process.env.SOCIAL_SERVICE_URL || "http://localhost:8788"
    }${path}`;
}
