import { GetServerSideProps } from "next";
import exhibitApi from "pages/api/exhibit";
import { feedBasicServerSideProps } from "./feedBasicServerSideProps";
import { measureSsrStage, withSsrTiming } from "./ssrTiming";
import {
    defaultCategoryFor,
    landingFeedFromResponse,
    parseFilters,
    setDefaultFeedCategory,
} from "@features/landing-carousel/data";
import { readStaffPickIds } from "@utils/staffPicks";
import {
    FeedCategory,
    LandingFeed,
    LandingPageProps,
} from "@features/landing-carousel/types";

/** As long as the landing waited for its feed over HTTP before. */
export const LANDING_FEED_TIMEOUT_MS = 7000;

const FEED_UNAVAILABLE = "The world feed is unavailable.";

type ApiHandler = (req: any, res: any) => unknown;

/**
 * The landing's first feed page, read by calling the `/api/exhibit` handler
 * in this process: the same query, caches and response body the browser gets,
 * without a second HTTP request (and possibly a second cold instance) from
 * the server to itself. Fails as the HTTP read did: on an error status, a
 * body without exhibits, or after the timeout. A read still running at the
 * timeout is not cancelled; its result is ignored.
 */
export function readLandingFeed(
    category: FeedCategory,
    {
        handler = exhibitApi as ApiHandler,
        timeoutMs = LANDING_FEED_TIMEOUT_MS,
    }: { handler?: ApiHandler; timeoutMs?: number } = {}
): Promise<LandingFeed> {
    return new Promise<LandingFeed>((resolve, reject) => {
        const timeout = setTimeout(
            () => reject(new Error(FEED_UNAVAILABLE)),
            timeoutMs
        );
        const settle = (run: () => LandingFeed) => {
            clearTimeout(timeout);
            try {
                resolve(run());
            } catch (error) {
                reject(error);
            }
        };
        const responseHeaders: Record<string, unknown> = {};
        const res = {
            statusCode: 200,
            headersSent: false,
            getHeader: (name: string) => responseHeaders[name.toLowerCase()],
            setHeader(name: string, value: unknown) {
                responseHeaders[name.toLowerCase()] = value;
                return res;
            },
            status(code: number) {
                res.statusCode = code;
                return res;
            },
            json(body: unknown) {
                res.headersSent = true;
                settle(() => {
                    if (res.statusCode < 200 || res.statusCode > 299)
                        throw new Error(FEED_UNAVAILABLE);
                    // The browser receives JSON; so do the props.
                    return landingFeedFromResponse(
                        JSON.parse(JSON.stringify(body)),
                        category
                    );
                });
                return res;
            },
            end() {
                res.headersSent = true;
                settle(() => {
                    throw new Error(FEED_UNAVAILABLE);
                });
                return res;
            },
        };
        const req = {
            method: "GET",
            url: `/api/exhibit?type=FETCH_ALL_EXHIBITS&isActive=${encodeURIComponent(
                category
            )}`,
            headers: {},
            query: { type: "FETCH_ALL_EXHIBITS", isActive: category },
            body: undefined,
        };
        Promise.resolve()
            .then(() => handler(req, res))
            .then(
                () =>
                    settle(() => {
                        throw new Error(FEED_UNAVAILABLE);
                    }),
                (error) =>
                    settle(() => {
                        throw error;
                    })
            );
    });
}

export const landingServerSideProps: GetServerSideProps<LandingPageProps> = (
    context
) =>
    withSsrTiming(context.res, async () => {
        // Staff picks lead once there are enough of them; until then Popular does.
        const staffPickCount = await readStaffPickIds()
            .then((ids) => ids.length)
            .catch(() => 0);
        const defaultCategory = defaultCategoryFor(staffPickCount);
        setDefaultFeedCategory(defaultCategory);
        const initialFilters = parseFilters(context.query);
        const [authResult, feedResult] = await Promise.allSettled([
            measureSsrStage("ssr_auth", () =>
                feedBasicServerSideProps(context)
            ),
            measureSsrStage("ssr_feed", () =>
                readLandingFeed(initialFilters.category)
            ),
        ]);
        return {
            props: {
                ...(authResult.status === "fulfilled"
                    ? authResult.value.props
                    : { authenticated: false }),
                initialFeed:
                    feedResult.status === "fulfilled"
                        ? feedResult.value
                        : { cards: [], cursor: "", hasMore: false },
                initialFilters,
                defaultCategory,
                initialError: feedResult.status === "rejected",
            },
        };
    });
