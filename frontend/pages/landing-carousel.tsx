import Head from "next/head";
import LandingCarouselPage from "@features/landing-carousel";
import { LandingPageProps } from "@features/landing-carousel/types";

export default function LandingCarousel(props: LandingPageProps) {
    return (
        <>
            <Head>
                <title>Oncyber — Go somewhere new</title>
                <meta
                    name="description"
                    content="Discover extraordinary 3D worlds and immersive art galleries made by independent creators. Find your next world on Oncyber."
                />
            </Head>
            <LandingCarouselPage {...props} />
        </>
    );
}

export { landingServerSideProps as getServerSideProps } from "@utils/serverside/landingServerSideProps";
