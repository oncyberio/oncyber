import { AuthServerSidePropsLite } from "@utils/authServerSideProps";
import DestinationsPage from "@features/destinations";

export default function Destination(props) {
    return <DestinationsPage />;
}

export const getServerSideProps = AuthServerSidePropsLite(async ({ params }) => {
    return {};
});
