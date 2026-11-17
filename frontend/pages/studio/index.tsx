//
import dynamic from "next/dynamic";
import { loadStudio, preloadStudio } from "@features/studio/loadStudio";
import { AuthServerSideProps } from "@utils/authServerSideProps";
import { getExhibitByCustomLink } from "pages/api/exhibit";
import { getDestination } from "@utils/saveToDb";
import { formatExhibit } from "@utils/metadata/formatExhibit";
import { Experience } from "@uitypes/experience";
import { useContext, useEffect } from "react";
import { UserContext } from "@components/context/UserContext";
import { useRouter } from "next/router";
import { getLocalAnonExhibit } from "@utils/anon";
import {
    BROWSE_TEMPLATES_HREF,
    needsTemplateFirst,
} from "@features/studio/StudioMenu/browseTemplates";

const Studio3D = dynamic(loadStudio, { ssr: false });

const Error = dynamic(() => import("@components/Error"));

export default function SpaceEdit(props) {
    //
    const {
        token,
        authenticated,
        user,
        userData,
        isAnonInitialized,
        exhibit,
        destination,
        isAnonymous,
    } = useContext(UserContext);

    const router = useRouter();

    // No world yet: pick a template first, before the studio renders.
    const templateFirst =
        isAnonInitialized &&
        !props.error &&
        needsTemplateFirst({
            isAnonymous,
            hasLocalWorld: isAnonymous && !!getLocalAnonExhibit(),
            exhibit: props.exhibit,
            templateId: router.query?.templateId,
        });

    useEffect(() => {
        if (templateFirst) router.replace(BROWSE_TEMPLATES_HREF);
    }, [templateFirst]);

    useEffect(() => {
        // Load the scene and its controls while route data is being restored.
        if (!templateFirst) void preloadStudio().catch(() => {});
    }, [templateFirst]);

    if (props.error) {
        return <Error statusCode={500} />;
    }

    if (templateFirst) return null;

    if (user?.id && userData?.currentExhibitId) {
        if (props.exhibit == null) {
            return <Error statusCode={404} />;
        }
    }

    return isAnonInitialized ? (
        <Studio3D
            {...props}
            exhibit={exhibit}
            destination={isAnonymous ? destination : props.destination}
        />
    ) : null;
}

export const getServerSideProps = AuthServerSideProps(
    async ({ query, res }, user, token, exhibit, isAnonymous) => {
        //
        let destination = null;

        try {
            if (exhibit != null && !isAnonymous) {
                destination = await getDestination(exhibit.info.room);
            }

            if (isAnonymous && query?.templateId) {
                const templateDestiantion = await getDestination(
                    query?.templateId
                );

                if (templateDestiantion) {
                    destination = templateDestiantion;
                }
            }

            return { destination };
            //
        } catch (err) {
            //
            console.error(err);

            return { error: err?.message || "Failed to fetch exhibit data" };
        }
    }
);
