import styled from "styled-components";
import Error from "@components/Error";
import dynamic from "next/dynamic";
import { getDestination } from "@utils/saveToDb";
import { AuthServerSidePropsLite } from "@utils/authServerSideProps";
import { getStylekitByRoom } from "pages/api/stylekit";
import { getDefaultCyberkitDataFromRoom } from "@components/_3DExhibit-v2/three/factory/space/roomdatacompat";

const Exhibit3DDisplay = dynamic(() => import("@3/displyUI/DisplayScene"), {
    ssr: false,
});

const defaultExhibit = (room, kitbash) => {
    //
    const exhibit = {
        info: {
            room: room.slug,
            heroImg: room.image,
            headline: room.name,
        },
        editors: [
            room.author?.id || "0x76DB02500F7631d57BC2DcDCa9d4cf782b99E119",
        ],
        owner: "",
        artworks: {},
        kitbash,
    };

    if (room.isFuture && exhibit.kitbash) {
        // @ts-ignore
        exhibit.kitbash = {
            ...exhibit.kitbash,
            ...getDefaultCyberkitDataFromRoom(room, exhibit.kitbash),
        };
    }

    return exhibit;
};

function Destination({ destination, stylekit, notfound }) {
    // const [ loading, setLoading ] = useState(true);

    // useEffect(() => {
    //     (async () => {
    //         // This can be done in getServerSideProps if you don't want to show the loading in the frontend
    //         const response = await fetch(destination.path)
    //         const room = await response.text();
    //         setRoomModel(room);

    //         console.log(room);
    //         setLoading(false);
    //     })()
    // }, []);

    if (notfound) {
        return <Error />;
    }

    return (
        <Container>
            {/* <Infobar>
                <p>
                    This destination is traded as an NFT on Opensea. Buying it
                    gives you the ability to showcase your collection in it.{" "}
                    <a href={destination?.openseaLink}>More info here</a>
                </p>
            </Infobar> */}
            <Exhibit3DDisplay
                destination={destination}
                assets={[]}
                editMode={false}
                artworks={[]}
                isSceneBackground
                exhibit={defaultExhibit(destination, stylekit?.kitbash)}
            />
        </Container>
    );
}

const Container = styled.div`
    width: 100%;
    height: 100%;
    position: absolute;
    top: 0;
    left: 0;

    @media (max-width: 600px) {
        height: -moz-available; /* WebKit-based browsers will ignore this. */
        height: -webkit-fill-available; /* Mozilla-based browsers will ignore this. */
        height: fill-available;
    }
`;

const Infobar = styled.div`
    position: absolute;
    bottom: 0;
    width: 100%;
    color: white;
    height: 80px;
    background: #010103;
    text-align: center;
    padding: 24px;
    z-index: 1000000;

    p {
        margin: 0;
    }

    a {
        text-decoration: underline;
    }
`;

export const getServerSideProps = AuthServerSidePropsLite(async ({ params }) => {
    const { id } = params;

    let kitbashErr;

    const [destination, stylekit] = await Promise.all([
        getDestination(id),
        getStylekitByRoom(id).catch((err) => {
            kitbashErr = err;
            return null;
        }),
    ]);

    if (destination?.isFuture && kitbashErr) {
        console.error(kitbashErr);
    }

    if (destination) {
        return {
            destination,
            stylekit,
        };
    }
    return {
        notfound: true,
    };
});

export default Destination;
