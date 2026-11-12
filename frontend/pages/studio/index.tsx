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

    useEffect(() => {
        // Load the scene and its controls while route data is being restored.
        void preloadStudio().catch(() => {});
    }, []);

    if (props.error) {
        return <Error statusCode={500} />;
    }

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
