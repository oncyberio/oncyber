import { LandingCard } from "./types";

const OPTIONS = [
    {
        id: "gallery",
        cover: "/landing-build/cyber-warehouse-1280.webp",
        title: "Gallery",
        description: "A space for your art, collections, and exhibitions.",
        status: "Create gallery",
        href: "/studio/new-gallery",
    },
    {
        id: "gaussian",
        cover: "/landing-build/jungle-ruins.jpg",
        title: "Gaussian",
        description: "Bring a captured place to life as an explorable world.",
        status: "Upload a scan",
        href: "/studio/new-splat",
    },
    {
        id: "videos",
        cover: "/landing-build/jungle-falls.jpg",
        title: "Videos",
        description: "Make films from your 3D worlds.",
        status: "Coming later",
        href: "",
    },
];

// Videos are listed but not available yet.
export const BUILD_CARDS: LandingCard[] = OPTIONS.map((option) => ({
    id: `build-${option.id}`,
    title: option.title,
    description: option.description,
    href: option.href,
    buildStatus: option.status,
    imageUrls: [option.cover],
    creator: "",
    owner: "",
    room: "",
    visits: 0,
    chains: [],
    collections: [],
    tags: [],
    portrait: false,
}));
