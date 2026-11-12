//
import dynamic from "next/dynamic";
import Studio3D from "@features/studio";
import { AuthServerSideProps } from "@utils/authServerSideProps";
import { getExhibitByCustomLink } from "pages/api/exhibit";
import { getDestination } from "@utils/saveToDb";
import { formatExhibit } from "@utils/metadata/formatExhibit";
import { Experience } from "@uitypes/experience";
import { useContext } from "react";
import { UserContext } from "@components/context/UserContext";

const Error = dynamic(() => import("@components/Error"));

export default function SpaceEdit(props) {
    //
    const { user, token, authenticated } = useContext(UserContext);

    const requiresSignup = !(authenticated && user?.id && token);

    let { exhibit, destination } = props;

    const isEditor =
        !requiresSignup &&
        props.exhibit?.editors?.some((it) => {
            //
            return it.toLowerCase() === user.id.toLowerCase();
        });

    if (props.exhibit == null || props.destination == null) {
        return <Error statusCode={404} />;
    }

    if (requiresSignup) {
        //
        exhibit = null;

        destination = null;
    } else if (!isEditor) {
        //
        return <Error statusCode={401} />;
    }

    return <Studio3D {...{ ...props, exhibit, destination }} />;
}

export const getServerSideProps = AuthServerSideProps(
    async ({ query, res }, user, token) => {
        //

        let exhibit = null;
        let destination = null;

        //
        exhibit = await getExhibitByCustomLink(query.id);

        if (exhibit != null) {
            //

            exhibit = formatExhibit(exhibit as Experience);

            destination = await getDestination(exhibit.info.room);
        }

        return { exhibit, destination };
    }
);
