import Head from "next/head";
import styled from "styled-components";
import JsonLd from "@components/JsonLd";
import { destinationSeo } from "@utils/destinationSeo";
import { SITE_NAME } from "@utils/siteMeta";
import { searchUrl } from "@utils/siteUrl";

/**
 * Head tags, structured data and (for the canvas page) the text of a
 * gallery or world template page. `kind="mint"` is its mint page, which
 * already shows its own heading and text.
 */
export default function DestinationSeo({
    destination,
    kind = "space",
}: {
    destination: any;
    kind?: "space" | "mint";
}) {
    const seo = destinationSeo(destination, kind);
    if (!seo) return null;
    const url = searchUrl(seo.path);
    return (
        <>
            <Head>
                <title key="title">{seo.title}</title>
                <meta
                    key="description"
                    name="description"
                    content={seo.description}
                />
                <link key="canonical" rel="canonical" href={url} />
                <meta key="ogUrl" property="og:url" content={url} />
                <meta key="ogTitle" property="og:title" content={seo.title} />
                <meta
                    key="ogDescription"
                    property="og:description"
                    content={seo.description}
                />
                <meta
                    key="twitterTitle"
                    name="twitter:title"
                    content={seo.title}
                />
                <meta
                    key="twitterDescription"
                    name="twitter:description"
                    content={seo.description}
                />
                {seo.image && (
                    <meta
                        key="ogImage"
                        property="og:image"
                        content={seo.image}
                    />
                )}
                {seo.image && (
                    <meta
                        key="twitterImage"
                        name="twitter:image"
                        content={seo.image}
                    />
                )}
            </Head>
            <JsonLd
                id="destination"
                data={{
                    "@context": "https://schema.org",
                    "@type": "WebPage",
                    "@id": url,
                    url,
                    name: seo.title,
                    description: seo.description,
                    isPartOf: { "@id": searchUrl("/#website") },
                    ...(seo.image ? { primaryImageOfPage: seo.image } : {}),
                    mainEntity: {
                        "@type": "CreativeWork",
                        name: seo.name,
                        description: seo.description,
                        genre: "3D space",
                        ...(seo.image ? { image: seo.image } : {}),
                        ...(seo.author
                            ? {
                                  creator: {
                                      "@type": "Organization",
                                      name: seo.author,
                                  },
                              }
                            : {}),
                    },
                }}
            />
            {kind === "space" && (
                <Hidden aria-label="About this space">
                    <h1>{seo.name}</h1>
                    <p>
                        3D space{seo.author && ` by ${seo.author}`} on{" "}
                        <a href="/" tabIndex={-1}>
                            {SITE_NAME}
                        </a>
                        .
                    </p>
                    {seo.paragraphs.map((paragraph, index) => (
                        <p key={index}>{paragraph}</p>
                    ))}
                </Hidden>
            )}
        </>
    );
}

const Hidden = styled.section`
    position: absolute;
    width: 1px;
    height: 1px;
    margin: -1px;
    padding: 0;
    overflow: hidden;
    clip: rect(0 0 0 0);
    clip-path: inset(50%);
    white-space: nowrap;
    border: 0;
`;
