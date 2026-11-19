import { useId, useState } from "react";
import type { LandingCard } from "../types";
import { COLLAGE_STRIPS, collageStrips } from "../grid/collage";
import { CoverImage } from "./ExperienceCard";

/** The collage is drawn on this canvas and scaled to cover the card. */
const WIDTH = 1280;
const HEIGHT = 800;

/**
 * Several covers on one card, as leaning strips with a white rule between
 * them. A cover that fails to load gives its place to the next candidate;
 * with fewer than two left, the card shows its ordinary cover.
 */
export default function CollageCover({ card }: { card: LandingCard }) {
    const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
    const [failed, setFailed] = useState<string[]>([]);
    const urls = (card.collage || [])
        .filter((url) => !failed.includes(url))
        .slice(0, COLLAGE_STRIPS);
    if (urls.length < 2) return <CoverImage card={card} />;
    const strips = collageStrips(urls.length, WIDTH, HEIGHT);
    return (
        <svg
            className="collage-cover"
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            preserveAspectRatio="xMidYMid slice"
            aria-hidden="true"
        >
            <defs>
                {strips.map((strip, index) => (
                    <clipPath key={index} id={`${id}-${index}`}>
                        <polygon
                            points={strip.corners
                                .map(([x, y]) => `${x},${y}`)
                                .join(" ")}
                        />
                    </clipPath>
                ))}
            </defs>
            {strips.map((strip, index) => (
                <image
                    key={urls[index]}
                    href={urls[index]}
                    x={strip.box.x}
                    y={strip.box.y}
                    width={strip.box.width}
                    height={strip.box.height}
                    preserveAspectRatio="xMidYMid slice"
                    clipPath={`url(#${id}-${index})`}
                    onError={() =>
                        setFailed((previous) => [...previous, urls[index]])
                    }
                />
            ))}
            {strips.slice(1).map(({ corners: [top, , , bottom] }, index) => (
                <line
                    key={index}
                    x1={top[0]}
                    y1={top[1]}
                    x2={bottom[0]}
                    y2={bottom[1]}
                    stroke="#fff"
                    strokeWidth={6}
                />
            ))}
        </svg>
    );
}
