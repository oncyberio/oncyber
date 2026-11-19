/** @jest-environment node */
import { profileHandle, profileSeo, profileStructuredData } from "./profileSeo";
import { searchUrl } from "./siteUrl";

const profile = {
    id: "0xfd22004806a6846ea67ad883356be810f0428793",
    username: "6529",
    walletId: "0xfd22004806a6846ea67ad883356be810f0428793",
    avatar: "https://example.com/a.png",
};
const space = (name: string, path: string) => ({ id: path, name, path });
const spaces = [
    space("6529 Museum District", "/6529om"),
    space("6529 AB + 1", "/6529ab"),
    space("OM Sector 0", "/omsector0"),
    space("6529 Photo A", "/6529photo"),
];

describe("profileSeo", () => {
    it("titles the page with the person and names their best-known spaces", () => {
        expect(profileSeo(profile, spaces)).toEqual({
            name: "@6529",
            path: "/@6529",
            title: "@6529 on oncyber",
            description:
                "@6529 on oncyber: 3D spaces including 6529 Museum District, 6529 AB + 1 and OM Sector 0. Visit them and see what they collect.",
            image: "https://example.com/a.png",
        });
    });

    it("reads well with one space, and with none", () => {
        expect(profileSeo(profile, spaces.slice(0, 1)).description).toBe(
            "@6529 on oncyber: 6529 Museum District. Visit their 3D spaces and see what they collect."
        );
        expect(profileSeo(profile).description).toBe(
            "@6529 on oncyber: their 3D spaces, the spaces showing their work, and what they collect."
        );
    });

    it("uses a short wallet, and the wallet's address, for an account with no name", () => {
        const seo = profileSeo({ id: profile.id, avatar: "ipfs://x" });
        expect(seo.name).toBe("0xfd22…8793");
        expect(seo.path).toBe(`/@${profile.id}`);
        expect(seo.image).toBeNull();
        expect(profileHandle({ id: "abc" })).toBe("abc");
    });

    it("is nothing without an account", () => {
        expect(profileSeo(null)).toBeNull();
        expect(profileSeo({})).toBeNull();
        expect(profileStructuredData({})).toBeNull();
    });
});

describe("profileStructuredData", () => {
    it("describes the page, the person and their spaces at the profile's address", () => {
        const data: any = profileStructuredData(profile, spaces);
        expect(data["@type"]).toBe("ProfilePage");
        expect(data.url).toBe(searchUrl("/@6529"));
        expect(data.mainEntity).toMatchObject({
            "@type": "Person",
            name: "@6529",
            alternateName: "6529",
            identifier: profile.walletId,
            image: "https://example.com/a.png",
        });
        expect(data.hasPart[0]).toEqual({
            "@type": "CreativeWork",
            name: "6529 Museum District",
            url: searchUrl("/6529om"),
        });
        expect(
            data.breadcrumb.itemListElement.map((item) => item.name)
        ).toEqual(["oncyber", "@6529"]);
    });

    it("lists no spaces when there are none", () => {
        expect(profileStructuredData(profile)).not.toHaveProperty("hasPart");
    });
});
