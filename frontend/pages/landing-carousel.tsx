import Head from "next/head";
import { SITE_TITLE } from "@components/layouts/headers";
import LandingCarouselPage from "@features/landing-carousel";
import JsonLd from "@components/JsonLd";
import { featuredSpacesStructuredData } from "@utils/structuredData";
import { LandingPageProps } from "@features/landing-carousel/types";

export default function LandingCarousel(props: LandingPageProps) {
    return (
        <>
            <Head>
                <title key="title">{SITE_TITLE}</title>
                {/* Keyed, so the home page has this one description and not
                    the site default before it. */}
                <meta
                    key="description"
                    name="description"
                    content="Discover extraordinary 3D worlds and immersive art galleries made by independent creators. Find your next world on Oncyber."
                />
            </Head>
            {/* The spaces the page features, for search engines and
                assistants; a missing link's page lists none. */}
            {!props.notFound && (
                <JsonLd
                    id="featured"
                    data={featuredSpacesStructuredData(
                        props.initialFeed?.cards
                    )}
                />
            )}
            <LandingCarouselPage {...props} />
        </>
    );
}

export { landingServerSideProps as getServerSideProps } from "@utils/serverside/landingServerSideProps";
