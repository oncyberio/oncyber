import type { CartoonDesign } from "./cartoonCast";

export function proportions(d: CartoonDesign) {
    const top = 12,
        jaw = top + d.head[1],
        neck =
            d.fit?.neckline ??
            jaw +
                (d.household
                    ? d.head[1] * (d.build === "lean" ? 0.09 : 0.055)
                    : d.build === "child"
                    ? 12
                    : d.build === "broad"
                    ? 18
                    : 24);
    const hip =
        d.fit?.hem ??
        neck + (d.height - neck) * (d.build === "child" ? 0.415 : 0.42);
    const shoulder =
            d.fit?.shoulder ??
            { child: 34, lean: 42, regular: 48, broad: 62 }[d.build],
        waist =
            d.fit?.waist ??
            shoulder *
                (d.build === "lean" ? 0.71 : d.build === "child" ? 0.87 : 0.82);
    return { top, jaw, neck, hip, shoulder, waist };
}
