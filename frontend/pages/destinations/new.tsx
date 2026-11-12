import { AuthServerSidePropsLite } from "@utils/authServerSideProps";
import { getCinematic, getDestinationBySlug } from "@utils/saveToDb";
import { deepClone } from "@utils/js";
import { Destination } from "@uitypes/destinations";
import { Spline } from "@uitypes/roomParameters";
import dynamic from "next/dynamic";
import { DefaultRoomParameters } from "@3utils/defaultroomparameters";
import styled from "styled-components";

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
            style={{ marginTop: "40px" }}
        >
            <Header>
                <h4>
                    Upload a GLB file to test your space and submit it for
                    release approval.
                </h4>
            </Header>
        </EditDestination>
    );
}

const Header = styled.div`
    width: 100%;
    display: flex;
    margin: 0 auto;
    max-width: 550px;
    text-align: center;
    align-items: center;
    flex-direction: column;
    justify-content: center;

    h4 {
        font-style: normal;
        font-weight: 600;
        font-size: 30px;
        line-height: 48px;
        color: #070707;
        margin-bottom: 0px;

        @media (max-width: 800px) {
            font-size: 25px;
            line-height: 38px;
        }

        @media (max-width: 600px) {
            font-size: 20px;
            line-height: 28px;
        }
    }
`;

export const getServerSideProps = AuthServerSidePropsLite(
    async ({ query, res }, user, token) => {
        //
        const upload = query.file || null;
        const future = !!query.future || false;

        return {
            destination: {
                params: {
                    ...deepClone(DefaultRoomParameters),
                    isFuture: future,
                },
            },
            upload,
        };
    }
);
