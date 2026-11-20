import Head from "next/head";
import styled from "styled-components";
import JsonLd from "@components/JsonLd";
import {
    ProfileForSeo,
    profileSeo,
    ProfileSpace,
    profileStructuredData,
} from "@utils/profileSeo";
import { SITE_NAME } from "@utils/siteMeta";
import { searchUrl } from "@utils/siteUrl";

/**
 * A profile link (/@name) is the lobby with that person's panel open. This
 * is what the page tells search engines, AI assistants and link previews:
 * the person's title, description and address, their structured data, and
 * their public spaces as links. The panel shows the same spaces once it
 * loads; these are in the server's HTML, out of sight and out of the tab
 * order. The page's h1 is set by the landing itself.
 */
export default function ProfileSeo({
    profile,
    spaces = [],
}: {
    profile: ProfileForSeo;
    spaces?: ProfileSpace[];
}) {
    const seo = profileSeo(profile, spaces);
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
                <meta key="ogType" property="og:type" content="profile" />
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
            </Head>
            <JsonLd
                id="profile"
                data={profileStructuredData(profile, spaces)}
            />
            <Hidden aria-label={`About ${seo.name}`}>
                <p>
                    {seo.name} on{" "}
                    <a href="/" tabIndex={-1}>
                        {SITE_NAME}
                    </a>
                    .
                </p>
                {spaces.length > 0 && (
                    <nav aria-label={`Spaces by ${seo.name}`}>
                        <h2>Spaces by {seo.name}</h2>
                        <ul>
                            {spaces.map((space) => (
                                <li key={space.id}>
                                    <a href={space.path} tabIndex={-1}>
                                        {space.name}
                                    </a>
                                </li>
                            ))}
                        </ul>
                    </nav>
                )}
            </Hidden>
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
