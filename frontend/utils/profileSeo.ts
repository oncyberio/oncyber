/**
 * What a profile link (/@name) tells search engines and link previews. The
 * page is the lobby with that person's panel open, so its title,
 * description and address are the person's, not the home page's.
 */
import { SITE_NAME } from "./siteMeta";
import { searchUrl } from "./siteUrl";

export interface ProfileForSeo {
    id?: string;
    username?: string;
    walletId?: string;
    avatar?: string;
}

export interface ProfileSpace {
    id: string;
    name: string;
    path: string;
}

export interface ProfileSeo {
    /** As shown: "@6529", or a short wallet. */
    name: string;
    /** The profile's own path: /@6529. */
    path: string;
    title: string;
    description: string;
    image: string | null;
}

const shortWallet = (id: string) =>
    id.length > 12 ? `${id.slice(0, 6)}…${id.slice(-4)}` : id;

/** The handle a profile's address uses: the username, else the account id. */
export function profileHandle(profile: ProfileForSeo): string {
    return profile?.username || profile?.id || "";
}

export function profileSeo(
    profile: ProfileForSeo,
    spaces: ProfileSpace[] = []
): ProfileSeo | null {
    const handle = profileHandle(profile);
    if (!handle) return null;
    const name = profile.username
        ? `@${profile.username}`
        : shortWallet(String(profile.id));
    const names = spaces.slice(0, 3).map((space) => space.name);
    const list =
        names.length > 1
            ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`
            : names[0];
    const description = !spaces.length
        ? `${name} on ${SITE_NAME}: their 3D spaces, the spaces showing their work, and what they collect.`
        : spaces.length <= 3
        ? `${name} on ${SITE_NAME}: ${list}. Visit their 3D spaces and see what they collect.`
        : `${name} on ${SITE_NAME}: 3D spaces including ${list}. Visit them and see what they collect.`;
    return {
        name,
        path: `/@${encodeURIComponent(handle).replace(/%40/g, "@")}`,
        title: `${name} on ${SITE_NAME}`,
        description,
        image:
            typeof profile.avatar === "string" &&
            /^https?:\/\//i.test(profile.avatar)
                ? profile.avatar
                : null,
    };
}

/** schema.org data for a profile: the page, the person, their spaces. */
export function profileStructuredData(
    profile: ProfileForSeo,
    spaces: ProfileSpace[] = []
): Record<string, unknown> | null {
    const seo = profileSeo(profile, spaces);
    if (!seo) return null;
    const url = searchUrl(seo.path);
    return {
        "@context": "https://schema.org",
        "@type": "ProfilePage",
        "@id": url,
        url,
        name: seo.title,
        description: seo.description,
        isPartOf: { "@id": searchUrl("/#website") },
        mainEntity: {
            "@type": "Person",
            "@id": `${url}#person`,
            name: seo.name,
            ...(profile.username ? { alternateName: profile.username } : {}),
            identifier: profile.walletId || profile.id,
            url,
            ...(seo.image ? { image: seo.image } : {}),
        },
        breadcrumb: {
            "@type": "BreadcrumbList",
            itemListElement: [
                {
                    "@type": "ListItem",
                    position: 1,
                    name: SITE_NAME,
                    item: searchUrl("/"),
                },
                {
                    "@type": "ListItem",
                    position: 2,
                    name: seo.name,
                    item: url,
                },
            ],
        },
        ...(spaces.length
            ? {
                  hasPart: spaces.slice(0, 24).map((space) => ({
                      "@type": "CreativeWork",
                      name: space.name,
                      url: searchUrl(space.path),
                  })),
              }
            : {}),
    };
}
