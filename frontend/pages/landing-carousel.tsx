import Head from "next/head";
import dynamic from "next/dynamic";
import { useRouter } from "next/router";
import { SITE_TITLE } from "@components/layouts/headers";
import LandingCarouselPage from "@features/landing-carousel";
import { firstScreenCovers } from "@features/landing-carousel/coverPreloads";
import JsonLd from "@components/JsonLd";
import ProfileSeo from "@components/seo/ProfileSeo";
import { featuredSpacesStructuredData } from "@utils/structuredData";
import { LandingPageProps } from "@features/landing-carousel/types";

// Shown for a profile link to nobody (status 404).
const NotFoundPage = dynamic(
    () => import("@features/landing-carousel/NotFoundPage")
);

export default function LandingCarousel(props: LandingPageProps) {
    const router = useRouter();
    if (props.notFound) return <NotFoundPage {...props} />;
    const query = router?.query ?? {};
    // A profile link (/@name): the lobby with that person's panel. While
    // the panel is open the page is theirs; closing it drops ?profile and
    // the page is the home page again.
    const visiting =
        typeof query.profile === "string" ? props.profile : undefined;
    // Only the grid of worlds shows these covers first: not the lobby, and
    // not the create step, which opens on templates.
    const covers =
        query.lobby === "1" || query.create
            ? []
            : firstScreenCovers(props.initialFeed?.cards);
    return (
        <>
            {visiting ? (
                <ProfileSeo profile={visiting} spaces={props.profileSpaces} />
            ) : (
                <>
                    <Head>
                        <title key="title">{SITE_TITLE}</title>
                        {/* Keyed, so the home page has this one description
                            and not the site default before it. */}
                        <meta
                            key="description"
                            name="description"
                            content="Discover extraordinary 3D worlds and immersive art galleries made by independent creators. Find your next world on Oncyber."
                        />
                        {covers.map((cover) => (
                            <link
                                key={`cover-preload:${cover.href}`}
                                rel="preload"
                                as="image"
                                href={cover.href}
                                media={cover.media}
                                // Ahead of the scripts, which the pictures
                                // used to wait behind.
                                fetchPriority="high"
                            />
                        ))}
                    </Head>
                    {/* The spaces the page features, for search engines
                        and assistants. */}
                    <JsonLd
                        id="featured"
                        data={featuredSpacesStructuredData(
                            props.initialFeed?.cards
                        )}
                    />
                </>
            )}
            <LandingCarouselPage {...props} />
        </>
    );
}

export { landingServerSideProps as getServerSideProps } from "@utils/serverside/landingServerSideProps";
