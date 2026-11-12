import type { CameraSpline, Vec3 } from "../model";

const EPSILON = 1e-4;

function extrapolate(a: Vec3, b: Vec3): Vec3 {
    return [2 * a[0] - b[0], 2 * a[1] - b[1], 2 * a[2] - b[2]];
}

function chordLength(a: Vec3, b: Vec3): number {
    const dx = a[0] - b[0];
    const dy = a[1] - b[1];
    const dz = a[2] - b[2];
    // Three.js's chordal Catmull-Rom uses distanceSquared^(alpha / 2),
    // with alpha=.5.
    return Math.pow(dx * dx + dy * dy + dz * dz, 0.25);
}

function component(
    p0: number,
    p1: number,
    p2: number,
    p3: number,
    dt0: number,
    dt1: number,
    dt2: number,
    t: number
): number {
    let tangent1 = (p1 - p0) / dt0 - (p2 - p0) / (dt0 + dt1) + (p2 - p1) / dt1;
    let tangent2 = (p2 - p1) / dt1 - (p3 - p1) / (dt1 + dt2) + (p3 - p2) / dt2;
    tangent1 *= dt1;
    tangent2 *= dt1;
    const c0 = p1;
    const c1 = tangent1;
    const c2 = -3 * p1 + 3 * p2 - 2 * tangent1 - tangent2;
    const c3 = 2 * p1 - 2 * p2 + tangent1 + tangent2;
    return ((c3 * t + c2) * t + c1) * t + c0;
}

export function sampleChordalSpline(
    spline: CameraSpline,
    normalizedTime: number
): Vec3 {
    const points = spline.points;
    if (points.length < 2)
        throw new Error("A camera spline needs at least two points.");
    const u = Math.max(0, Math.min(1, normalizedTime));
    const segmentCount = points.length - 1;
    const scaled = u * segmentCount;
    const segment = Math.min(Math.floor(scaled), segmentCount - 1);
    const local = u === 1 ? 1 : scaled - segment;
    const p1 = points[segment];
    const p2 = points[segment + 1];
    const p0 = segment > 0 ? points[segment - 1] : extrapolate(p1, p2);
    const p3 =
        segment + 2 < points.length ? points[segment + 2] : extrapolate(p2, p1);
    let dt0 = chordLength(p0, p1);
    let dt1 = chordLength(p1, p2);
    let dt2 = chordLength(p2, p3);
    if (dt1 < EPSILON) dt1 = 1;
    if (dt0 < EPSILON) dt0 = dt1;
    if (dt2 < EPSILON) dt2 = dt1;
    return [0, 1, 2].map((axis) =>
        component(p0[axis], p1[axis], p2[axis], p3[axis], dt0, dt1, dt2, local)
    ) as unknown as Vec3;
}
