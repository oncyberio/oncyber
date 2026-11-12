import express from "express";
import corsMiddlewre from "cors";
import cookieParser from "cookie-parser";
import authMiddleware from "../middleware/auth";

export interface ExpressOpts {
    cors: boolean;
    auth: boolean;
}

export function createApp({ cors, auth }: ExpressOpts) {
    const app = express();

    if (cors) {
        app.use(
            corsMiddlewre({
                origin: true,
                methods: ["GET", "OPTIONS", "PATCH", "DELETE", "POST", "PUT"],
                credentials: true,
                allowedHeaders: ["X-CSRF-Token", "X-Requested-With", "Accept", "Accept-Version", "Content-Length", "Content-MD5", "Content-Type", "Date", "X-Api-Version", "*"],
            })
        );
    }

    app.use(cookieParser());

    if (auth) {
        app.use(authMiddleware);
    }

    return app;
}
