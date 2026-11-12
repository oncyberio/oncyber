import type { ProceduralSetNode, SetOption, Transform3D, Vec3 } from "./types";
import { freezeValue } from "./immutable";

const transform = (
    position: Vec3,
    rotationDeg: Vec3 = [0, 0, 0],
    scale: Vec3 = [1, 1, 1]
): Transform3D => ({ position, rotationDeg, scale });

const node = (
    id: string,
    name: string,
    primitive: ProceduralSetNode["primitive"],
    position: Vec3,
    size: Vec3,
    color: string,
    rotationDeg: Vec3 = [0, 0, 0],
    roughness = 0.72,
    metalness = 0
): ProceduralSetNode => ({
    id,
    name,
    primitive,
    transform: transform(position, rotationDeg),
    size,
    material: { color, roughness, metalness },
});

/** Three deliberately small procedural stages for the first Video Lab flow. */
export const DEMO_SET_OPTIONS: readonly SetOption[] = freezeValue([
    {
        id: "white-cube",
        title: "White Cube",
        subtitle: "A quiet gallery with a long, clean camera lane.",
        tags: ["gallery", "minimal", "interior", "bright"],
        palette: ["#f0efe9", "#c9c5bb", "#20201f"],
        nodes: [
            node(
                "floor",
                "Stone floor",
                "box",
                [0, -0.1, 0],
                [18, 0.2, 14],
                "#c9c5bb"
            ),
            node(
                "back-wall",
                "Back wall",
                "box",
                [0, 3, -7],
                [18, 6, 0.25],
                "#f0efe9"
            ),
            node(
                "left-wall",
                "Left wall",
                "box",
                [-9, 3, 0],
                [0.25, 6, 14],
                "#e6e4dd"
            ),
            node(
                "right-wall",
                "Right wall",
                "box",
                [9, 3, 0],
                [0.25, 6, 14],
                "#e6e4dd"
            ),
            node(
                "plinth-a",
                "Low plinth",
                "box",
                [-3.2, 0.55, -1.5],
                [2.2, 1.1, 2.2],
                "#f7f6f1"
            ),
            node(
                "plinth-b",
                "Tall plinth",
                "box",
                [3.4, 0.85, 1.8],
                [1.7, 1.7, 1.7],
                "#f7f6f1"
            ),
        ],
    },
    {
        id: "cobalt-pavilion",
        title: "Cobalt Pavilion",
        subtitle: "Graphic arches and a reflective central runway.",
        tags: ["architectural", "cobalt", "editorial", "interior"],
        palette: ["#1747d1", "#84a8ff", "#eee6d2"],
        nodes: [
            node(
                "floor",
                "Blue runway",
                "box",
                [0, -0.12, 0],
                [16, 0.24, 18],
                "#12389e",
                [0, 0, 0],
                0.28,
                0.15
            ),
            node(
                "rear",
                "Warm rear wall",
                "box",
                [0, 3.5, -9],
                [16, 7, 0.3],
                "#eee6d2"
            ),
            node(
                "column-l1",
                "Left column one",
                "cylinder",
                [-5, 2.4, -4],
                [1.2, 4.8, 1.2],
                "#1747d1"
            ),
            node(
                "column-r1",
                "Right column one",
                "cylinder",
                [5, 2.4, -4],
                [1.2, 4.8, 1.2],
                "#1747d1"
            ),
            node(
                "column-l2",
                "Left column two",
                "cylinder",
                [-5, 2.4, 3],
                [1.2, 4.8, 1.2],
                "#84a8ff"
            ),
            node(
                "column-r2",
                "Right column two",
                "cylinder",
                [5, 2.4, 3],
                [1.2, 4.8, 1.2],
                "#84a8ff"
            ),
            node(
                "portal",
                "Portal header",
                "box",
                [0, 5.2, -4],
                [11, 0.8, 1.1],
                "#1747d1"
            ),
        ],
    },
    {
        id: "sunset-monoliths",
        title: "Sunset Monoliths",
        subtitle: "Open-air sculptural forms made for orbiting shots.",
        tags: ["exterior", "sunset", "sculptural", "orbit"],
        palette: ["#ef855d", "#6c4a8d", "#f4d39b"],
        nodes: [
            node(
                "ground",
                "Sand platform",
                "cylinder",
                [0, -0.35, 0],
                [18, 0.7, 18],
                "#f4d39b"
            ),
            node(
                "monolith-a",
                "Coral monolith",
                "box",
                [-3.8, 2.5, -1.5],
                [2.2, 5, 1.8],
                "#ef855d",
                [0, 18, -4],
                0.64
            ),
            node(
                "monolith-b",
                "Violet monolith",
                "box",
                [2.8, 3.4, 0.2],
                [2.1, 6.8, 2.1],
                "#6c4a8d",
                [0, -16, 3],
                0.58
            ),
            node(
                "orb",
                "Sun orb",
                "sphere",
                [0.2, 2.1, -4.2],
                [2.6, 2.6, 2.6],
                "#ffd27c",
                [0, 0, 0],
                0.32,
                0.08
            ),
            node(
                "bench",
                "Viewing bench",
                "box",
                [0, 0.45, 4],
                [4.5, 0.9, 1.1],
                "#a65c58"
            ),
        ],
    },
] as readonly SetOption[]);

export type SetConstructionTemplate = "gallery" | "pavilion" | "landscape";

const TEMPLATE_SET: Record<SetConstructionTemplate, string> = {
    gallery: "white-cube",
    pavilion: "cobalt-pavilion",
    landscape: "sunset-monoliths",
};

/** Builds a compact project-owned Three.js set from an editable template. */
export function constructProceduralSet(input: {
    id: string;
    title: string;
    direction: string;
    template: SetConstructionTemplate;
    palette: readonly [string, string, string];
}): SetOption {
    const base = findSetOption(TEMPLATE_SET[input.template])!;
    const direction = input.direction.trim().slice(0, 220);
    const title = input.title.trim().slice(0, 120);
    const tags = Array.from(
        new Set(
            [
                "custom",
                input.template,
                ...direction
                    .toLocaleLowerCase()
                    .split(/[^a-z0-9]+/)
                    .filter((term) => term.length > 2)
                    .slice(0, 8),
            ].slice(0, 12)
        )
    );
    return freezeValue({
        id: input.id,
        title: title || "Untitled set",
        subtitle:
            direction || `A custom ${input.template} built in Video Studio.`,
        tags,
        palette: [...input.palette],
        nodes: base.nodes.map((source, index) => ({
            ...source,
            material: {
                ...source.material,
                color: input.palette[index % input.palette.length],
            },
        })),
    });
}

function normalized(value: string): string {
    return value
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim()
        .toLocaleLowerCase();
}

export function searchSetCatalog(
    query = "",
    requiredTags: readonly string[] = [],
    catalog: readonly SetOption[] = DEMO_SET_OPTIONS
): readonly SetOption[] {
    const terms = normalized(query).split(/\s+/).filter(Boolean);
    const tags = requiredTags.map(normalized);
    return catalog.filter((option) => {
        const optionTags = option.tags.map(normalized);
        if (!tags.every((tag) => optionTags.includes(tag))) return false;
        const haystack = normalized(
            [option.title, option.subtitle, ...option.tags].join(" ")
        );
        return terms.every((term) => haystack.includes(term));
    });
}

export function findSetOption(
    id: string,
    catalog: readonly SetOption[] = DEMO_SET_OPTIONS
): SetOption | undefined {
    return catalog.find((option) => option.id === id);
}
