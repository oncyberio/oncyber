import type { PlayRecipe } from "../../../multiplayer/protocol/play-zone";

/**
 * Starter games for the dev page. Each is the loose shape a prompt would
 * produce; the server fills in and clamps the rest (readPlayRecipe).
 */
export const STARTER_RECIPES: Array<{
    id: string;
    label: string;
    recipe: Partial<PlayRecipe> & Pick<PlayRecipe, "things">;
}> = [
    {
        id: "ball-pit",
        label: "Ball pit",
        recipe: {
            title: "Ball pit",
            seconds: 60,
            things: [
                {
                    kind: "ball",
                    count: 150,
                    size: 0.18,
                    bounce: 0.55,
                    weight: 0.3,
                    drop: "rain",
                    color: 0,
                },
                {
                    kind: "ball",
                    count: 150,
                    size: 0.18,
                    bounce: 0.55,
                    weight: 0.3,
                    drop: "rain",
                    color: 2,
                },
            ],
            hit: { reach: 1.2, power: 7, lift: 0.5 },
        },
    },
    {
        id: "volleyball",
        label: "Volleyball",
        recipe: {
            title: "Volleyball",
            seconds: 90,
            gravity: 6,
            arena: { halfX: 7, halfZ: 4, walls: true, net: 1.6 },
            things: [
                {
                    kind: "ball",
                    count: 1,
                    size: 0.3,
                    bounce: 0.75,
                    weight: 0.15,
                    drop: "center",
                    color: 5,
                },
            ],
            hit: { reach: 1.6, power: 9, lift: 0.75 },
            score: "floor-touch",
        },
    },
    {
        id: "clear-your-side",
        label: "Clear your side",
        recipe: {
            title: "Clear your side",
            seconds: 45,
            arena: { halfX: 7, halfZ: 5, walls: true, net: 0.6 },
            things: [
                {
                    kind: "box",
                    count: 40,
                    size: 0.25,
                    bounce: 0.2,
                    weight: 0.3,
                    drop: "sides",
                    color: 1,
                },
                {
                    kind: "ball",
                    count: 40,
                    size: 0.22,
                    bounce: 0.6,
                    weight: 0.3,
                    drop: "sides",
                    color: 3,
                },
            ],
            hit: { reach: 1.4, power: 9, lift: 0.6 },
            score: "side-count",
        },
    },
];
