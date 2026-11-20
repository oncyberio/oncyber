/** @jest-environment node */
import { destinationSeo } from "./destinationSeo";

const x1 = {
    name: "X1",
    slug: "x1",
    description:
        "Visit the space at oncyber.io/destinations/x1. From the team behind Chalk and Coal galleries comes the new space.\nThe X1 gallery was designed as a scalable space.",
    author: { id: "0xf679", name: "Chalk" },
    thumbnail: "https://example.com/x1.png",
    image: "",
};

test("a template page is named after the space and described in its own words", () => {
    expect(destinationSeo(x1)).toEqual({
        name: "X1",
        title: "X1 · 3D space on oncyber",
        description:
            "From the team behind Chalk and Coal galleries comes the new space. The X1 gallery was designed as a scalable space.",
        paragraphs: [
            "From the team behind Chalk and Coal galleries comes the new space.",
            "The X1 gallery was designed as a scalable space.",
        ],
        author: "Chalk",
        image: "https://example.com/x1.png",
        path: "/destinations/x1",
    });
});

test("its mint page has its own title and address", () => {
    expect(destinationSeo(x1, "mint")).toMatchObject({
        title: "Mint X1 · oncyber",
        path: "/mints/x1",
    });
});

test("a template without a description, author or image still says what it is", () => {
    expect(
        destinationSeo({
            name: "Wolfgang №2",
            slug: "wolfgang-n2_v2",
            description: "",
            author: { id: "id" },
            thumbnail: "https://res.cloudinary.com/oncyber-io/image/x.png",
        })
    ).toMatchObject({
        description:
            "Wolfgang №2, a 3D space on oncyber to visit and make your own.",
        paragraphs: [],
        author: "",
        image: null,
    });
});

test("nothing without a name or an address", () => {
    expect(destinationSeo(null)).toBeNull();
    expect(destinationSeo({ name: "X" })).toBeNull();
    expect(destinationSeo({ slug: "x" })).toBeNull();
});
