import { nodeEnv } from "@env";
import Cors from "cors";

function initMiddleware(middleware) {
    return (req, res) =>
        new Promise((resolve, reject) => {
            middleware(req, res, (result) => {
                if (result instanceof Error) {
                    return reject(result);
                }
                return resolve(result);
            });
        });
}

// Credentialed origins: only our own sites. Third parties must not be able to
// call the API with a visitor's session.
const origin = [
    "https://oncyber.io",
    "https://www.oncyber.io",
    "https://cyber.xyz",
    "https://www.cyber.xyz",
    "https://oncyber.com",
    "https://www.oncyber.com",
    "https://mmo.oncyber.io",
];

if (nodeEnv.GIT_BRANCH_PREVIEW_URL) {
    origin.push(nodeEnv.GIT_BRANCH_PREVIEW_URL);
}

if (process.env.NODE_ENV === "development") {
    origin.push("http://localhost:8080");
}

export const corsMiddleware = initMiddleware(
    Cors({
        origin,
        methods: ["GET", "OPTIONS", "PATCH", "DELETE", "POST", "PUT"],
        credentials: true,
        allowedHeaders: [
            "X-CSRF-Token",
            "X-Requested-With",
            "Accept",
            "Accept-Version",
            "Content-Length",
            "Content-MD5",
            "Content-Type",
            "Date",
            "X-Api-Version",
            "*",
        ],
    })
);
