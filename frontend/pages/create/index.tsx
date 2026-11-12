import { NextPage } from "next";

// /create always redirects to /studio (here and in next.config.js), so this
// page never renders. It no longer pulls in the legacy dashboard editor.
const Home: NextPage = () => null;

export function getServerSideProps() {
    //
    return {
        redirect: {
            destination: "/studio",
            permanent: true,
        },
    };
}

export default Home;
