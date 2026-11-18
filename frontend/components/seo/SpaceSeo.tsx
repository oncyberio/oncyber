import { useMemo } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import JsonLd from "@components/JsonLd";
import { searchUrl } from "@utils/siteUrl";
import { spaceContent } from "@utils/spaceContent";
import { spaceSeo } from "@utils/spaceSeo";
import { spaceShareImage } from "@utils/spaceShareImage";
import { spaceStructuredData } from "@utils/structuredData";
import SpaceSummary from "./SpaceSummary";

/**
 * Everything a space page tells search engines, AI assistants and link
 * previews: its head tags, its structured data and its text. Used by every
 * kind of space (native galleries and embedded worlds alike), so none is
 * left with the site's default title.
 */
export default function SpaceSeo({
    experience,
    destination,
    ownerName,
}: {
    experience: any;
    destination?: { image?: string; name?: string } | null;
    ownerName?: string | null;
}) {
    const router = useRouter();
    const query = router?.query;
    const seo = useMemo(
        () => spaceSeo(experience, { ownerName, query }),
        [experience, ownerName, query]
    );
    const content = useMemo(() => spaceContent(experience), [experience]);
    if (!experience) return null;
    // The address search engines and link previews should credit for this
    // space, whichever URL (old domain, /spaces/<id>, /ja/...) was opened.
    const canonicalUrl = searchUrl(seo.canonicalPath);
    const shareImage = spaceShareImage(experience, destination);
    const space = {
        ...experience,
        ownerName: experience.ownerName ?? ownerName,
    };
    return (
        <>
            <Head>
                <title>{seo.title}</title>
                <meta
                    key="description"
                    name="description"
                    content={seo.description}
                />
                <meta key="keywords" name="keywords" content={seo.keywords} />
                <meta
                    key="ogTitle"
                    property="og:title"
                    content={experience.info?.headline}
                />
                <meta
                    key="ogDescription"
                    property="og:description"
                    content={seo.socialDescription}
                />
                <link key="canonical" rel="canonical" href={canonicalUrl} />
                <meta key="ogUrl" property="og:url" content={canonicalUrl} />
                <meta key="ogImage" property="og:image" content={shareImage} />
                <meta
                    key="ogImageAlt"
                    property="og:image:alt"
                    content={seo.title}
                />
                <meta
                    key="twitterTitle"
                    name="twitter:title"
                    content={seo.title}
                />
                <meta
                    key="twitterImage"
                    name="twitter:image"
                    content={shareImage}
                />
                <meta
                    key="twitterImageAlt"
                    name="twitter:image:alt"
                    content={seo.title}
                />
                <meta
                    key="twitterCard"
                    name="twitter:card"
                    content="summary_large_image"
                />
                <meta
                    key="twitterDescription"
                    name="twitter:description"
                    content={seo.socialDescription}
                />
            </Head>
            <JsonLd
                id="space"
                data={spaceStructuredData(space, {
                    path: seo.canonicalPath,
                    description: seo.socialDescription,
                    image: shareImage,
                    featuring: seo.featuring,
                    content,
                })}
            />
            <SpaceSummary
                space={space}
                featuring={seo.featuring}
                content={content}
                gallery={destination?.name}
            />
        </>
    );
}
