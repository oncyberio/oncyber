/**
 * Where a party stands while it gathers and travels: side by side, facing
 * the way the person who started the trip faces, so the travel camera sees
 * every avatar. Nobody stands directly in front of or behind anybody else.
 *
 * Up to six stand in one row. Seven or eight make two rows, and the back row
 * stands in the gaps of the front one.
 */
export interface FormationPose {
    x: number;
    y: number;
    z: number;
    rotation: number;
}

/** Metres between neighbours in a row, and between the two rows. */
export const FORMATION_SPACING = 1.3;
export const FORMATION_ROW_DEPTH = 1.5;
/** The most travellers one row holds before a second row starts. */
export const FORMATION_ROW_MAX = 6;

/**
 * Each traveller's place, in steps to the right of the first traveller and
 * rows behind them. The first traveller is the one the others gather round
 * and stays where they are; the rest alternate right and left of them.
 */
export function formationSlots(count: number): { side: number; row: number }[] {
    const total = Math.max(0, Math.floor(count));
    const front = total > FORMATION_ROW_MAX ? Math.ceil(total / 2) : total;
    const slots: { side: number; row: number }[] = [];
    for (let index = 0; index < total; index++) {
        if (index < front) {
            // 0, +1, -1, +2, -2, ...
            const step = Math.ceil(index / 2);
            slots.push({ side: index % 2 ? step : -step || 0, row: 0 });
        } else {
            // +0.5, -0.5, +1.5, -1.5, ...: the gaps of the front row.
            const place = index - front;
            const step = Math.floor(place / 2) + 0.5;
            slots.push({ side: place % 2 ? -step : step, row: 1 });
        }
    }
    return slots;
}

/** The travellers' poses around `anchor`, in the order given; the first keeps the anchor. */
export function formationPoses(anchor: FormationPose, count: number): FormationPose[] {
    // An avatar turned by `rotation` faces (sin, cos); its right is (cos, -sin).
    const sin = Math.sin(anchor.rotation),
        cos = Math.cos(anchor.rotation);
    return formationSlots(count).map(({ side, row }) => {
        const right = side * FORMATION_SPACING,
            back = row * FORMATION_ROW_DEPTH;
        return { x: anchor.x + cos * right - sin * back, y: 0, z: anchor.z - sin * right - cos * back, rotation: anchor.rotation };
    });
}
