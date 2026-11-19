import { BufferAttribute, BufferGeometry, MathUtils } from "three/webgpu";
import { insetPupilUVBase } from "./surfaces";

export type PupilSpan = {
    start: number;
    count: number;
    shift: [number, number, number];
};

/** The globe stores a direction and distance from the pupil center. Moving that
 * center only rewrites those two attributes on its surviving corneal vertices. */
export function createGazePose(geometry: BufferGeometry) {
    const spans: PupilSpan[] | undefined = geometry.userData.pupilSpans;
    if (!spans?.length) return;
    const normal = geometry.attributes.normal as BufferAttribute;
    const uv = geometry.attributes.uv as BufferAttribute;
    // Capture only the two corneas, including their exact neutral float values.
    const eyes = spans.map((span) => ({
        ...span,
        normals: normal.array.slice(
            3 * span.start,
            3 * (span.start + span.count)
        ),
        uv: uv.array.slice(2 * span.start, 2 * (span.start + span.count)),
    }));
    let current = 0;
    return (weight: number) => {
        if (!Number.isFinite(weight)) return;
        const next = MathUtils.clamp(weight, 0, 1);
        if (next === current) return;
        current = next;
        normal.clearUpdateRanges();
        uv.clearUpdateRanges();
        for (const eye of eyes) {
            for (let i = 0; i < eye.count; i++) {
                const at = i + eye.start,
                    n = 3 * i;
                const distance = eye.uv[2 * i] - insetPupilUVBase;
                if (next === 0) {
                    normal.setXYZ(
                        at,
                        eye.normals[n],
                        eye.normals[n + 1],
                        eye.normals[n + 2]
                    );
                    uv.setX(at, eye.uv[2 * i]);
                    continue;
                }
                const x = eye.normals[n] * distance - next * eye.shift[0];
                const y = eye.normals[n + 1] * distance - next * eye.shift[1];
                const z = eye.normals[n + 2] * distance - next * eye.shift[2];
                const length = Math.hypot(x, y, z);
                const inv = length > 0 ? 1 / length : 0;
                normal.setXYZ(at, x * inv, y * inv, z * inv);
                uv.setX(at, insetPupilUVBase + length);
            }
            normal.addUpdateRange(3 * eye.start, 3 * eye.count);
            uv.addUpdateRange(2 * eye.start, 2 * eye.count);
        }
        normal.needsUpdate = uv.needsUpdate = true;
    };
}
