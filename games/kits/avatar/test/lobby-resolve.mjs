// The kit plays the lobby's own motion code (frontend/features/lobby). That
// source imports its neighbours without an extension, as the frontend's
// bundler allows; Node needs the ".ts" spelled out. Vite needs none of this.
import { registerHooks } from "node:module";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

registerHooks({
    resolve(specifier, context, next) {
        if (
            specifier.startsWith(".") &&
            !/\.[cm]?[jt]s$|\.json$/.test(specifier) &&
            context.parentURL?.includes("/features/lobby/")
        ) {
            const url = new URL(specifier + ".ts", context.parentURL);
            if (existsSync(fileURLToPath(url))) return next(url.href, context);
        }
        return next(specifier, context);
    },
});
