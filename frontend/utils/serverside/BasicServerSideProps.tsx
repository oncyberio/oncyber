import nookies from "nookies";
import { measureSsrStage, withSsrTiming } from "./ssrTiming";

import { auth } from "../middlewares/authMiddleware";
import { fetchUserByWalletIdCached } from "@api/accounts/user/utils";

/**
 * `prefetch` (optional) starts the page's reads that do not depend on who is
 * signed in, at the same time as the sign-in and profile reads instead of
 * after them. Its promise is passed to the page callback as a fourth
 * argument, for the page to await where it used to start those reads. A page
 * callback that throws is retried as signed out, as before; the retry reuses
 * the prefetch, or starts it again if it failed.
 */
export const BasicServerSideProps = (
    getServerSideProps = async (
        context,
        user = null,
        token = null,
        prefetched: Promise<any> = undefined
    ) => ({}),
    { prefetch }: { prefetch?: (context) => unknown } = {}
) => {
    const resolve = async (context) => {
        const startPrefetch = () => {
            const started = Promise.resolve().then(() => prefetch(context));
            // The page may not await it (a redirect, a profile page).
            started.catch(() => {});
            return started;
        };
        let prefetched = prefetch ? startPrefetch() : undefined;
        let prefetchHanded = false;
        const page = (user?, token?) => {
            if (!prefetch) {
                return user === undefined
                    ? getServerSideProps(context)
                    : getServerSideProps(context, user, token);
            }
            if (prefetchHanded) {
                // The retry: keep a finished read, start a failed one again.
                const previous = prefetched;
                prefetched = previous.catch(() => startPrefetch());
                prefetched.catch(() => {});
            }
            prefetchHanded = true;
            return getServerSideProps(context, user, token, prefetched);
        };

        try {
            const cookies = nookies.get(context);

            let token = cookies?.[cookies?.["_CCA"]];

            const walletId = await measureSsrStage("ssr_auth", () =>
                auth({ cookies })
            );

            let user = await measureSsrStage("ssr_user", () =>
                fetchUserByWalletIdCached(walletId.toLowerCase())
            );

            if (!user) {
                return {
                    props: {
                        authenticated: false,
                        ...(await measureSsrStage("ssr_page", () => page())),
                    },
                };
            }

            return {
                props: {
                    userId: walletId,
                    user,
                    authenticated: true,
                    token,
                    ...(await measureSsrStage("ssr_page", () =>
                        page(user, token)
                    )),
                },
            };
        } catch (err) {
            console.log("err", err);
            return {
                props: {
                    authenticated: false,
                    ...(await measureSsrStage("ssr_page", () => page())),
                },
            };
        }
    };
    return (context) =>
        withSsrTiming(context.res, async () => {
            const result = await resolve(context);
            if (result.props && "redirect" in result.props)
                return { redirect: result.props.redirect };
            return result;
        });
};
