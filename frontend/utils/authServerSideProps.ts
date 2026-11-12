import { User } from "../@types/user";

import { auth } from "./middlewares/authMiddleware";

import nookies from "nookies";

import { db } from "./firebaseAdmin";

import { amplitude_logAnalyticsEvent } from "./analytics";

import { isAutographUser } from "./autographAssets";

import { formatExhibit } from "./metadata/formatExhibit";

import { getExhibitById } from "pages/api/exhibit";

import { withSsrTiming } from "./serverside/ssrTiming";

import { handleInviteAccess } from "pages/api/invite/access";

import { initAnonUser } from "./anon";
import { fetchUserByWalletId, getUserByDoc } from "@api/accounts/user/utils";
import { applyTemplate } from "pages/api/space/template";
import { createSpace } from "pages/api/space/createshortcut";
import {
    getAccountDoc,
    getAccountDocCached,
} from "@api/accounts/authenticate/utils/link";

export const AuthServerSideProps = (
    getServerSideProps = async (
        context,
        user = null,
        token = null,
        exhibit = null,
        isAnonymous = false
    ) => ({}),
    // `full: true` reads the user's whole `exhibits` subcollection + current
    // exhibit doc on every navigation. Only the studio consumes those
    // (ExhibitContext), so every other authenticated page passes
    // `{ full: false }` and skips the reads.
    { full = true } = {}
) => {
    const resolve = async (context) => {
        const cookies = nookies.get(context);

        let token = cookies?.[cookies?.["_CCA"]];

        const isInvite =
            context?.resolvedUrl &&
            context?.resolvedUrl?.indexOf("/studio") === 0 &&
            context?.query?.inviteId;

        const isDuplicate =
            context?.resolvedUrl &&
            context?.resolvedUrl?.indexOf("/studio") === 0 &&
            context?.query?.spaceDuplicateId;

        const isTemplate =
            context?.resolvedUrl &&
            context?.resolvedUrl?.indexOf("/studio") === 0 &&
            context?.query?.templateId;

        let walletId = null;

        //1. Authenticate the user
        console.log("Authenticating user...");

        try {
            walletId = await auth({ cookies });
        } catch (err) {
            // anon is allowed only for studio
            if (/^\/studio(?:\/|$)/.test((context.resolvedUrl || context.req.url).split("?")[0])) {
                const anonUser = initAnonUser(isTemplate);

                return {
                    props: {
                        user: null,
                        ...(await getServerSideProps(
                            context,
                            null,
                            null,
                            anonUser.exhibit,
                            true
                        )),
                        ...anonUser,
                    },
                };
            }
        }
        console.log("Authenticating user...", walletId);

        if (!token || context?.query?.new === "true") {
            return {
                props: {
                    user: null,
                    authenticated: false,
                    ...(await getServerSideProps(context)),
                },
            };
        }

        let invite = null;

        //2. Access Invite Link

        if (isInvite) {
            console.log("Accessing invite link...");

            amplitude_logAnalyticsEvent("open_collab_link", {
                inviteId: context.query.inviteId,
                invitedUser: walletId,
            });

            try {
                const _invite = await handleInviteAccess(
                    context.query.inviteId,
                    walletId
                );

                if (_invite.success) {
                    invite = {
                        success: true,
                        message: _invite.message,
                    };

                    const { exhibit } = _invite;

                    amplitude_logAnalyticsEvent("accessed_invite_link", {
                        exhibitId: exhibit.id,
                        invitedUser: walletId,
                        inviteId: context.query.inviteId,
                        ownerId: exhibit.owner, // The one who invited the user
                        exhibitOwnerId: exhibit?.owner,
                        exhibitName: exhibit?.info?.headline,
                        collabs: exhibit?.editors?.length > 1,
                        number_of_artworks: Object.keys(exhibit?.artworks || {})
                            .length,
                    });
                } else {
                    const { message } = _invite;

                    invite = {
                        success: false,
                        message,
                    };

                    amplitude_logAnalyticsEvent(
                        "failed_accessing_invite_link",
                        {
                            inviteId: context.query.inviteId,
                            message: message,
                        }
                    );
                }
            } catch (err) {
                console.log("Error", err.message);
            }
        }

        //3. Fetch User Data
        console.log("Fetching user data...");

        // Studio (full) hydration needs the raw doc — its currentExhibitId
        // consumers have write sites that don't invalidate the profile cache.
        // Lite pages only hydrate display fields, all invalidation-covered.
        const userDoc = full
            ? await getAccountDoc(walletId)
            : await getAccountDocCached(walletId);

        if (!userDoc) {
            return {
                props: {
                    user: null,
                    authenticated: false,
                    ...(await getServerSideProps(context)),
                },
            };
        }

        let overwrite = {
            currentExhibitId: "",
        };

        // 3.2
        if (isDuplicate) {
            console.log("Accessing deplication...");

            amplitude_logAnalyticsEvent("open_duplicate_space_link", {
                spaceDuplicateId: context.query.spaceDuplicateId,
            });

            try {
                const template = await applyTemplate(isDuplicate, userDoc.id);

                if (template.success) {
                    invite = {
                        success: true,
                        message: template.message,
                    };

                    const { exhibit } = template;

                    overwrite.currentExhibitId = exhibit.id;

                    amplitude_logAnalyticsEvent(
                        "accessed_duplicate_space_link",
                        {
                            exhibitId: exhibit.id,
                            invitedUser: walletId,
                            spaceDuplicateId: context.query.spaceDuplicateId,
                            ownerId: exhibit.owner, // The one who invited the user
                            exhibitOwnerId: exhibit?.owner,
                            exhibitName: exhibit?.info?.headline,
                            collabs: exhibit?.editors?.length > 1,
                            number_of_artworks: Object.keys(
                                exhibit?.artworks || {}
                            ).length,
                        }
                    );
                } else {
                    const { message } = template;
                    invite = {
                        success: false,
                        message,
                    };
                    amplitude_logAnalyticsEvent(
                        "failed_accessing_duplicate_space_link",
                        {
                            spaceDuplicateId: context.query.spaceDuplicateId,
                            message: message,
                        }
                    );
                }
            } catch (err) {
                console.log("Error", err.message);
            }
        }

        // 3.3
        if (isTemplate) {
            console.log("Accessing templating...");

            amplitude_logAnalyticsEvent("open_template_link", {
                templateId: isTemplate,
            });

            try {
                const template = await createSpace(
                    userDoc.id,
                    isTemplate,
                    userDoc.data().linkedAccounts
                );

                if (template.success) {
                    invite = {
                        success: true,

                        message: template.message,
                    };

                    const { exhibit } = template;

                    overwrite.currentExhibitId = exhibit.id;

                    amplitude_logAnalyticsEvent("accessed_template_link", {
                        exhibitId: exhibit.id,
                        invitedUser: walletId,
                        templateId: isTemplate,
                        ownerId: exhibit.owner, // The one who invited the user
                        exhibitOwnerId: exhibit?.owner,
                        exhibitName: exhibit?.info?.headline,
                        collabs: exhibit?.editors?.length > 1,
                        number_of_artworks: Object.keys(exhibit?.artworks || {})
                            .length,
                    });
                } else {
                    const { message } = template;

                    invite = {
                        success: false,
                        message,
                    };

                    amplitude_logAnalyticsEvent(
                        "failed_accessing_template_link",
                        {
                            templateId: isTemplate,
                            message: message,
                        }
                    );
                }
            } catch (err) {
                console.log("Error", err.message);
            }
        }

        // let snap = await db
        //     .collection("users")
        //     .where("walletId", "==", walletId.toLowerCase())
        //     .get();

        // ! user doesn't exist

        const fulluser = await getUserByDoc(
            userDoc,
            full ? true : "self",
            overwrite
        );

        if (!fulluser) {
            return {
                props: {
                    user: null,
                    authenticated: false,
                    ...(await getServerSideProps(context)),
                },
            };
        }

        let { exhibit, ...user } = fulluser;
        // http://localhost:3000/studio?inviteId=Mz31wSiJTgxDLYUPvZlm

        // const doc = snap.docs[0];

        // // 4. Fetch User Exhibits

        // const userExhibitsSnapshot = await db
        //     .collection("users")
        //     .doc(doc.id)
        //     .collection("exhibits")
        //     .get();

        // const exhibitIds = [];

        // userExhibitsSnapshot.forEach((doc) => {
        //     exhibitIds.push({
        //         id: doc.id,
        //         ...doc.data(),
        //     });
        // });

        // 5. Check if user is an autograph user
        console.log("Checking if user is an autograph user...");

        let isAutograph = await isAutographUser(walletId);

        // const user: User = {
        //     ...(doc.data() as User),
        //     id: doc.id,
        //     exhibitIds,
        // };

        if (!full) {
            // Non-studio page: no exhibit was fetched and no studio `step`
            // should be set (UserProvider only dispatches a truthy step).
            return {
                props: {
                    invite,
                    user,
                    authenticated: true,
                    token,
                    userId: walletId,
                    ...(await getServerSideProps(context, user, token)),
                    isAutograph,
                },
            };
        }

        if (!exhibit) {
            return {
                props: {
                    user,
                    authenticated: true,
                    token,
                    userId: walletId,
                    step: "create-destination",
                    ...(await getServerSideProps(context, user, token)),
                    isAutograph,
                },
            };
        }

        // 6. Fetch user current exhibit

        // In case we don't find the currentExhibit
        if (exhibit == null) {
            if (user.exhibitIds?.[0]?.id) {
                exhibit = await getExhibitById(user.exhibitIds?.[0]?.id);
            }
        }

        if (!exhibit?.info?.room) {
            return {
                props: {
                    invite,
                    user,
                    authenticated: true,
                    token,
                    userId: walletId,
                    step: "create-destination",
                    ...(await getServerSideProps(context, user, token)),
                },
            };
        }
        // get destination for this exhibit
        // var destination = await getDestination(exhibit?.info?.room);

        return {
            props: {
                invite,
                userId: walletId,
                user,
                exhibit: formatExhibit(exhibit),
                authenticated: true,
                token,
                ...(await getServerSideProps(context, user, token, exhibit)),
                isAutograph,
            },
        };
    };
    // Server-Timing: ssr_total plus the page's own stages (for /spaces/[id],
    // the exhibit, destination and owner reads in utils/ssr).
    return (context) =>
        withSsrTiming(context?.res, async () => {
            const result = await resolve(context);
            if (result.props && "redirect" in result.props)
                return { redirect: result.props.redirect };
            return result;
        });
};

// Authenticated SSR for pages OUTSIDE the studio: same auth + user hydration,
// but skips the per-navigation `exhibits` subcollection and current-exhibit
// reads that only the studio's ExhibitContext consumes.
export const AuthServerSidePropsLite = (getServerSideProps?) =>
    AuthServerSideProps(getServerSideProps, { full: false });
