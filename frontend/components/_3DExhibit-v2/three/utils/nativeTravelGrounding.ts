const MAX_SETTLE_DISTANCE = 0.25;
const SETTLE_STEP = 0.025;
const CONTACT_EPSILON = 1e-7;

function collisionShape(physics: any, feet: any) {
    const collisions = physics?.collisions;
    const capsule = collisions?.capsule;
    if (
        physics?.flymode ||
        physics?.playerState?.flyMode ||
        collisions?.isFlymode ||
        !capsule?.start?.set ||
        !capsule?.end?.set ||
        ![feet?.x, feet?.y, feet?.z].every(Number.isFinite)
    )
        return undefined;
    const height =
        collisions.getColliderHeight?.() ?? collisions.collider_height;
    const radius = capsule.radius;
    if (
        !Number.isFinite(height) ||
        !Number.isFinite(radius) ||
        radius <= 0 ||
        height < radius
    )
        return undefined;
    return { collisions, capsule, height, radius };
}

/** Resolve a small unfinished fall before the black arrival frame is revealed.
 * Query the real capsule footprint, never a point ray or a named floor. All
 * probes are detached: missing/unsafe support leaves the live scene untouched. */
export function resolveNativeTravelGroundedFeet(physics: any, feet: any) {
    const shape = collisionShape(physics, feet);
    if (
        !shape?.capsule.clone ||
        !shape.collisions.worldOctree?.capsuleIntersect
    )
        return undefined;
    const { collisions, height, radius } = shape;
    const probe = shape.capsule.clone();
    for (let step = 0; step <= MAX_SETTLE_DISTANCE / SETTLE_STEP; step++) {
        const y = feet.y - step * SETTLE_STEP;
        probe.start.set(feet.x, y + radius, feet.z);
        probe.end.set(feet.x, y + height, feet.z);
        const contact = collisions.worldOctree.capsuleIntersect(probe);
        if (!contact) continue;
        const { normal, depth } = contact;
        if (
            ![normal?.x, normal?.y, normal?.z, depth].every(Number.isFinite) ||
            depth < 0
        )
            return undefined;
        // Zero aggregate displacement at exact contact has no usable normal.
        // A tiny later probe lets the native solver report its supporting face.
        if (depth <= CONTACT_EPSILON && normal.y === 0) continue;
        if (normal.y <= 0.4) return undefined;
        const grounded = probe.start.clone();
        grounded.y -= radius;
        grounded.addScaledVector(normal, depth);
        if (
            Math.hypot(
                grounded.x - feet.x,
                grounded.y - feet.y,
                grounded.z - feet.z
            ) >
            MAX_SETTLE_DISTANCE + CONTACT_EPSILON
        )
            return undefined;
        return grounded;
    }
    return undefined;
}

/** The native third-person solver advances its cached capsule, not position.y.
 * Seed it from the displayed arrival feet before controls resume, including the
 * matching first-person target. No collision correction runs at this boundary. */
export function synchronizeNativeTravelGrounding(physics: any, feet: any) {
    const shape = collisionShape(physics, feet);
    if (!shape) return false;
    const { collisions, capsule, height, radius } = shape;
    const firstPerson =
        physics.shouldUseFirsPerson?.() ?? physics.playerState?.isFirstPerson;
    // A mode switch must bind the camera target before this handoff. A stale
    // first-person flag with the old player target would turn live feet into
    // head coordinates, then drop a full collider height on the next frame.
    if (
        firstPerson &&
        [
            physics.target,
            physics.position,
            physics.firstPersonPos,
            physics.playerState?.position,
        ].includes(feet)
    )
        return false;
    // Snapshot before writing: the third-person target may alias the feet.
    const { x, y, z } = feet;
    collisions.collider_height = height;
    capsule.start.set(x, y + radius, z);
    capsule.end.set(x, y + height, z);
    collisions.capsuleStart?.copy(capsule.start);
    collisions.capsuleEnd?.copy(capsule.end);
    physics.thirdPersonPos?.set(x, y, z);
    physics.firstPersonPos?.set(x, y + height, z);
    const targetY = firstPerson ? y + height : y;
    physics.position?.set(x, targetY, z);
    physics.playerState?.position?.set(x, targetY, z);
    physics.playerState?.veclocity?.set(0, 0, 0);
    return true;
}
