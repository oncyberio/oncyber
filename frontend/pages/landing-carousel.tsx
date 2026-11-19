import Head from "next/head";
import { useRouter } from "next/router";
import { SITE_TITLE } from "@components/layouts/headers";
import LandingCarouselPage from "@features/landing-carousel";
import { firstScreenCovers } from "@features/landing-carousel/coverPreloads";
import { LandingPageProps } from "@features/landing-carousel/types";

export default function LandingCarousel(props: LandingPageProps) {
    const { query } = useRouter();
    // Only the grid of worlds shows these covers first: not the lobby, and
    // not the create step, which opens on templates.
    const covers =
        query.lobby === "1" || query.create
            ? []
            : firstScreenCovers(props.initialFeed?.cards);
    return (
        <>
            <Head>
                <title key="title">{SITE_TITLE}</title>
                <meta
                    name="description"
                    content="Discover extraordinary 3D worlds and immersive art galleries made by independent creators. Find your next world on Oncyber."
                />
                {covers.map((cover) => (
                    <link
                        key={`cover-preload:${cover.href}`}
                        rel="preload"
                        as="fetch"
                        href={cover.href}
                        media={cover.media}
                        crossOrigin="anonymous"
                    />
                ))}
            </Head>
            <LandingCarouselPage {...props} />
        </>
    );
}

export { landingServerSideProps as getServerSideProps } from "@utils/serverside/landingServerSideProps";
