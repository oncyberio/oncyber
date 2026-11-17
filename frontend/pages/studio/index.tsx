//
import dynamic from "next/dynamic";
import { loadStudio, preloadStudio } from "@features/studio/loadStudio";
import { AuthServerSideProps } from "@utils/authServerSideProps";
import { getExhibitByCustomLink } from "pages/api/exhibit";
import { getDestination } from "@utils/saveToDb";
import { formatExhibit } from "@utils/metadata/formatExhibit";
import { Experience } from "@uitypes/experience";
import { useContext, useEffect, useRef } from "react";
import { UserContext } from "@components/context/UserContext";
import { useRouter } from "next/router";
import styled from "styled-components";
import { baseTokens } from "@styles/tokens";
import CyberloopMark from "@features/landing-carousel/components/CyberloopMark";
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
    // Decided once, on arrival: the studio later drops `templateId` from
    // the address, which must not send a guest back to the templates.
    const arrival = useRef<boolean>(null);
    if (arrival.current === null && isAnonInitialized && !props.error) {
        arrival.current = needsTemplateFirst({
            isAnonymous,
            hasLocalWorld: isAnonymous && !!getLocalAnonExhibit(),
            exhibit: props.exhibit,
            templateId: router.query?.templateId,
        });
    }
    const templateFirst = arrival.current === true;

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

    // Black, like the loader before it and the templates after it, so the
    // hand-off never flashes the page's white background.
    if (templateFirst) return <BlackScreen />;

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
    ) : (
        <BlackScreen />
    );
}

// Black with the Cyberloop playing in the middle while the studio works out
// where to go.
const BlackScreen = () => (
    <Waiting aria-hidden="true">
        <CyberloopMark continuous />
    </Waiting>
);

const Waiting = styled.div`
    position: fixed;
    inset: 0;
    display: grid;
    place-items: center;
    background: ${baseTokens.color.black};
    .cyberloop-mark {
        width: 50px;
        height: 50px;
    }
`;

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
