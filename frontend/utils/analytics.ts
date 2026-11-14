// PostHog analytics wrapper.
//
// The exported `amplitude_*` names are kept verbatim so the ~150 call sites
// across the app don't have to change. Internally everything now routes
// through posthog-js. Event names keep their historical "spaces" form
// (e.g. `play_cinematic` -> "play cinematic") so dashboards stay consistent
// with the Amplitude-era naming.

import cookie from "cookie";
import { IS_FRONTEND_ENV } from "./isFrontend";

export function isMacMobile() {
    return (
        [
            "iPad Simulator",
            "iPhone Simulator",
            "iPod Simulator",
            "iPad",
            "iPhone",
            "iPod",
        ].includes(navigator.platform) ||
        // iPad on iOS 13 detection
        (navigator.userAgent.includes("Mac") && "ontouchend" in document)
    );
}

/**
 * Sent with every event, pageviews and exceptions included. `frontend` tells
 * this open-source frontend apart from the old oncyber.io build, which sends
 * to the same PostHog project without it.
 */
export function analyticsSuperProperties(
    env: Record<string, string | undefined> = {
        NEXT_PUBLIC_BUILD_SHA: process.env.NEXT_PUBLIC_BUILD_SHA,
        NEXT_PUBLIC_DEPLOY_ENV: process.env.NEXT_PUBLIC_DEPLOY_ENV,
    }
) {
    return {
        frontend: "oncyber-v2",
        build: env.NEXT_PUBLIC_BUILD_SHA || "unknown",
        deploy_env: env.NEXT_PUBLIC_DEPLOY_ENV || "unknown",
    };
}

// posthog-js instance (lazily imported), and the 3D constants module used to
// stamp the current game mode onto every event.
export let posthog;
export let constants = null;

let initialized = false;
let initPromise = null;

const isDev = () => process.env.NODE_ENV === "development";

async function loadPosthog() {
    if (!posthog) {
        posthog = (await import("posthog-js")).default;
    }

    if (constants === null) {
        // The three-free module that holds IS_MULTIPLAYER: `@3constants`
        // would download three.js and the engine on every page.
        constants = await import(
            "@components/_3DExhibit-v2/three/shellconstants"
        );
    }

    return posthog;
}

// Boots posthog-js exactly once. Subsequent calls return the same in-flight /
// resolved promise so concurrent events can safely await readiness. Resolves to
// `false` when analytics is a no-op (dev, SSR, or missing project key).
async function initPosthog(user_id = "") {
    if (isDev() || typeof window === "undefined") return false;

    if (initPromise) {
        await initPromise;
        return initialized;
    }

    // Required env (must be present at BUILD time — NEXT_PUBLIC_* are inlined):
    //   NEXT_PUBLIC_POSTHOG_KEY   — project API key (phc_...)
    //   NEXT_PUBLIC_POSTHOG_HOST  — used by the server client; the browser uses
    //                               the /ingest reverse proxy (see next.config.js)
    // Set these in Vercel (Production + Preview) or analytics stays a no-op.
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;

    if (!key) {
        // No project key configured — stay a no-op rather than throwing on
        // every event for the whole session.
        return false;
    }

    initPromise = (async () => {
        await loadPosthog();

        posthog.init(key, {
            api_host: "/ingest",
            ui_host: "https://us.posthog.com",
            defaults: "2026-01-30",
            // We send explicit, named events from the call sites — don't also
            // autocapture every DOM click. Pageviews + UTM/referrer are still
            // captured automatically by posthog-js.
            autocapture: false,
            capture_pageview: true,
            capture_exceptions: true,
            persistence: "localStorage+cookie",
        });

        posthog.register(analyticsSuperProperties());

        if (user_id) {
            posthog.identify(user_id);
        }

        initialized = true;
    })();

    await initPromise;
    return initialized;
}

// Ensures posthog is ready before an identify/property call. Lazily boots it for
// anonymous sessions if the explicit init (from UserContext) hasn't run yet.
async function ensureReady() {
    if (isDev() || typeof window === "undefined") return false;
    if (!initialized) await initPosthog();
    return initialized;
}

export function setCookie(name, value) {
    const _cookie = cookie.serialize(name, value, {
        maxAge: 60 * 60 * 24 * 30,
        // expires:
        path: "/",
    });

    document.cookie = _cookie;
}

export function getCookie(name) {
    const cookies = cookie.parse(document.cookie);

    // We remove the moment we use it
    document.cookie = `${name}=${cookies[name]}; expires=Thu, 18 Dec 2013 12:00:00 UTC; path=/`;

    return cookies[name];
}

export async function amplitude_logAnalyticsEvent(
    type = "",
    eventPropreties = {},
    init = false,
    user_id = ""
) {
    if (typeof window !== "undefined") {
        eventPropreties = {
            ...eventPropreties,
            viewportSize: `${window.screen.width}x${window.screen.height}`,
            windowsSize: `${window.innerWidth}x${window.innerHeight}`,
            resolutionSize: `${window.screen.width * window.devicePixelRatio}x${
                window.screen.height * window.devicePixelRatio
            }`,
        };
    }

    if (isDev()) {
        console.log(
            "%c DEV_POSTHOG" + " %c" + type,
            "background: #2fa1d6; color: #ffff22",
            "background: #ffff22; color: #2fa1d6",
            eventPropreties,
            init,
            user_id
        );

        return;
    }

    // `init` calls (from UserContext after auth resolves) only boot the SDK and
    // bind the user — they don't emit an event.
    if (init) {
        await initPosthog(user_id);
        return;
    }

    if (IS_FRONTEND_ENV && isMacMobile()) {
        eventPropreties.xdevice = "iPad";
    }

    eventPropreties["game_mode"] = constants?.IS_MULTIPLAYER
        ? "multiplayer"
        : "single";

    // For events fired before UserContext's explicit init (e.g. anonymous
    // landing-page actions), lazily boot posthog so nothing is dropped.
    if (!(await ensureReady())) return;

    posthog.capture(type.replaceAll("_", " "), eventPropreties);
}

// Manual bug report → PostHog error tracking. posthog-js already autocaptures
// UNHANDLED exceptions (capture_exceptions: true), but errors swallowed in
// try/catch or .catch() never reach it — use this to surface them WITH context
// (which space, which asset, which device, etc.) so we can see them as they
// happen. Safe no-op in dev / SSR / web workers (no window) or when analytics is
// disabled. Never throws.
export async function reportError(
    error: unknown,
    context: Record<string, any> = {}
) {
    if (isDev() || typeof window === "undefined") {
        if (isDev()) console.error("[reportError]", error, context);
        return;
    }

    try {
        if (!(await ensureReady())) return;

        const err = error instanceof Error ? error : new Error(String(error));

        // posthog-js >= 1.x exposes captureException; fall back to a named event
        // if an older build is ever pinned.
        if (typeof posthog.captureException === "function") {
            posthog.captureException(err, context);
        } else {
            posthog.capture("$exception", {
                $exception_message: err.message,
                $exception_type: err.name,
                ...context,
            });
        }
    } catch (_e) {
        // reporting must never break the caller
    }
}

export async function amplitude_setIndetity(type, payload) {
    if (!(await ensureReady())) return;

    posthog.setPersonProperties({ [type]: payload });
}

export async function amplitude_setUserId(user_id) {
    if (isDev()) {
        console.log("DEV_POSTHOG setUserId", user_id);
        return;
    }

    if (!(await ensureReady())) return;

    posthog.identify(user_id);
}

export async function amplitude_identify_user(accounts) {
    if (!(await ensureReady())) return;

    posthog.setPersonProperties({ other_accounts: Object.keys(accounts) });
}

export function amplitude_logUserExhibits(exhibits) {
    if (isDev()) return;

    let createdExhibits = 0;
    let invitedExhibits = 0;
    let curatorExhibits = 0;
    let totalExhibits = 0;
    let isCollaborator = false;

    exhibits.forEach((exhibit) => {
        const { invited, isCurator } = exhibit;

        if (invited) {
            isCollaborator = true;
        }

        if (!invited && !isCurator) {
            createdExhibits++;
        }
        if (invited) {
            invitedExhibits++;
        }
        if (isCurator) {
            curatorExhibits++;
        }
        totalExhibits++;
    });

    amplitude_setIndetity("exhibits", {
        createdExhibits,
        invitedExhibits,
        totalExhibits,
        curatorExhibits,
        collaborator: isCollaborator,
    });
}

// PostHog has no client-side person-property increment (unlike Amplitude's
// Identify().add()). All real call sites are currently commented out, so this is
// a safe no-op retained for signature compatibility.
export async function incrementAnalytics(type1, type2, inc = 1) {
    return;
}
