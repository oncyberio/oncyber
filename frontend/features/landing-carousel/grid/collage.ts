/** How many covers a collage shows. */
export const COLLAGE_STRIPS = 5;
/** How far a strip's top edge sits right of its bottom edge, per height. */
export const COLLAGE_LEAN = 0.16;

type Point = [number, number];

export interface CollageStrip {
    /** Top left, top right, bottom right, bottom left. */
    corners: [Point, Point, Point, Point];
    /** The upright rectangle the strip's picture has to cover. */
    box: { x: number; y: number; width: number; height: number };
}

/**
 * Equal leaning strips across a picture: the cuts between them tilt the same
 * way, and the outer strips run past the frame so its corners stay filled.
 */
export function collageStrips(
    count: number,
    width: number,
    height: number
): CollageStrip[] {
    const lean = height * COLLAGE_LEAN;
    const cut = (index: number, y: number) => {
        if (index <= 0) return -lean;
        if (index >= count) return width + lean;
        // A cut crosses the middle of the picture at an even division.
        return (width * index) / count + lean * (0.5 - y / height);
    };
    return Array.from({ length: count }, (_, index) => {
        const corners: CollageStrip["corners"] = [
            [cut(index, 0), 0],
            [cut(index + 1, 0), 0],
            [cut(index + 1, height), height],
            [cut(index, height), height],
        ];
        const left = Math.max(0, Math.min(corners[0][0], corners[3][0]));
        const right = Math.min(width, Math.max(corners[1][0], corners[2][0]));
        return {
            corners,
            box: { x: left, y: 0, width: right - left, height },
        };
    });
}

/** Where to draw a picture so it fills a box, centred, keeping its shape. */
export function coverFit(
    imageWidth: number,
    imageHeight: number,
    box: CollageStrip["box"]
) {
    const scale = Math.max(box.width / imageWidth, box.height / imageHeight);
    const width = imageWidth * scale;
    const height = imageHeight * scale;
    return {
        x: box.x + (box.width - width) / 2,
        y: box.y + (box.height - height) / 2,
        width,
        height,
    };
}
