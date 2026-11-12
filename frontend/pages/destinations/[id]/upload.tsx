import { AuthServerSidePropsLite } from "@utils/authServerSideProps";
import { getCinematic, getDestinationBySlug } from "@utils/saveToDb";
import { deepClone } from "@utils/js";
import { Destination } from "@uitypes/destinations";
import { Spline } from "@uitypes/roomParameters";
import dynamic from "next/dynamic";
import { DefaultRoomParameters } from "@3utils/defaultroomparameters";

const EditDestination = dynamic(
    () => import("@features/destinations/components/EditDestination"),
    { ssr: false }
);

interface UploaderEditProps {
    destination: Destination;
    spline: Spline;
    upload: string;
    error?: string;
}

//
export default function UploaderUpload({
    destination,
    spline,
    upload,
    error,
}: UploaderEditProps) {
    //

    return (
        <EditDestination
            destination={destination}
            spline={spline}
            upload={upload}
            error={error}
        />
    );
}

export const getServerSideProps = AuthServerSidePropsLite(
    async ({ query, res }, user, token) => {
        //
        const slug = query.id as string;
        const upload = query.file || null;

        // New destination, gets state from session storage

        return {
            destination: {
                params: deepClone(DefaultRoomParameters),
                author: { id: user?.id },
            },
            upload,
        };
    }
);
