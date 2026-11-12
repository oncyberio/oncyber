import styled from "styled-components";
import Error from "../../../components/Error";
import Submit from "../../../components/factory/Submit";
import { getDestinationBySlug } from "@utils/firestore/destinations";

function Minter({ destination, notfound }) {
    if (notfound) {
        return <Error />;
    }

    return (
        <Container>
            <Submit destination={destination} />
        </Container>
    );
}

const Container = styled.div`
    width: 100%;
    height: 100%;
    position: absolute;
    top: 0;
    left: 0;
    background: linear-gradient(#1f1f1f, #111111);

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

export async function getServerSideProps(context) {
    const { id } = context.params;

    const destination = await getDestinationBySlug(id);

    if (destination) {
        return {
            props: {
                destination,
            },
        };
    }
    return {
        props: {
            notfound: true,
        },
    };
}

export default Minter;
