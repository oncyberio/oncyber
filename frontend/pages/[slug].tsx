import { getUserByUsername, getUserByWalletId } from "../utils/saveToDb";

import { AuthServerSideProps } from "../utils/authServerSideProps";
import {
    ExhibitPageData,
    fetchExhibitData,
    prefetchSlugPageData,
} from "../utils/ssr";
import { GetServerSidePropsContext } from "next";
import { checkGating } from "@utils/checkGatingRules";
import dynamic from "next/dynamic";
import { BasicServerSideProps } from "@utils/serverside/BasicServerSideProps";
import { useEffect } from "react";
import { amplitude_logAnalyticsEvent } from "@utils/analytics";
import {
    fetchUserByUsername,
    fetchUserByWalletId,
} from "@api/accounts/user/utils";

const Profile = dynamic(() => import("../components/profile"));

const Error = dynamic(() => import("../components/Error"));

// Keep the visitor shell in the route chunk; only the engine needs lazy loading.
import Space from "./spaces/[id]";

function getExhibitPath(exhibit, pathname) {
    if (pathname?.toLowerCase() !== "/[slug]") return null;
    let slug = exhibit?.info?.customLink;
    return slug != null ? `/${slug}` : null;
}

export default function CustomLinkExhibit({
    experience,
    dest,
    isProfile,
    profile,
    gatingError,
}) {
    useEffect(() => {
        if (isProfile) {
            amplitude_logAnalyticsEvent("view_profile_page", {
                ...profile,
            });
        }
    }, []);

    if (isProfile && !profile) {
        return <Error statusCode={404} />;
    }

    if (isProfile) {
        return <Profile userData={profile} />;
    }

    if (!experience?.editors) {
        return <Error statusCode={404} />;
    }

    // if (gatingError) {
    //     return (
    //         <Error
    //             statusCode={403}
    //             forbidError={getGatingErrMessage(gatingError.type, experience)}
    //         />
    //     );
    // }

    return (
        <Space
            experience={experience}
            dest={dest}
            getExhibitPath={getExhibitPath}
            gatingError={gatingError}
        />
    );
}

export const getServerSideProps = BasicServerSideProps(
    async (
        { params, query, req, resolvedUrl }: GetServerSidePropsContext,
        user,
        token,
        prefetched: Promise<ExhibitPageData> | undefined
    ) => {
        // We check if the first character is @
        if (params.slug?.[0] === "@") {
            let data = await fetchUserByUsername(params.slug);

            if (!data) {
                data = await fetchUserByWalletId(
                    (params.slug as string).toLowerCase()
                );

                if (data) {
                    return {
                        // props: {
                        isProfile: true,
                        profile: data,
                        // },
                    };
                }

                return {
                    // props: {
                    isProfile: true,
                    profile: null,
                    // },
                };
            }

            return {
                // props: {
                isProfile: true,
                profile: data,
                // },
            };
        }

        if (params.slug === "built") params.slug = "BUILT"; // temporary quick hack

        // Started beside the sign-in reads (prefetchSlugPageData below).
        const data =
            (await prefetched) ??
            (await fetchExhibitData(params.slug as string, "slug", query));

        let gatingError = null;

        if (data.experience) {
            // solo mode should be cheked server side for safety
            let result = await checkGating(data.experience, user, 0);
            gatingError = result.type === "success" ? null : result;
        }

        return {
            ...data,
            gatingError,
        };
    },
    { prefetch: prefetchSlugPageData }
);
