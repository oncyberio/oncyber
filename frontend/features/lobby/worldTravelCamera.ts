import type { LobbyTravelView } from "./lobbyJourneyProtocol";
type Point = { x: number; y: number; z: number };
type Lens = { near: number; fov: number; aspect: number };
export interface CompactTravelCameraProfile {
    avatarHeight: number;
    focusHeight: number;
    sideOffset: number;
    fov: number;
    baseFov: number;
    blend: number;
}

/** Keep compact framing in controls until enough space exists for the ordinary
 * follow camera. Hysteresis-free smooth bounds avoid an exit-frame camera jump. */
export function advanceCompactTravelCamera(
    profile: CompactTravelCameraProfile,
    clearance: number,
    delta: number
) {
    const range = profile.avatarHeight * 0.65;
    const t = Math.max(
        0,
        Math.min(1, (clearance - profile.avatarHeight * 1.25) / range)
    );
    const target = 1 - t * t * (3 - 2 * t);
    profile.blend +=
        (target - profile.blend) *
        (1 - Math.exp(-2.5 * Math.max(0, Math.min(delta, 0.05))));
    return profile.blend;
}

export function compactTravelCameraTarget(
    profile: CompactTravelCameraProfile,
    nativeHeight: number,
    yaw: number
) {
    const side = profile.sideOffset * profile.blend;
    return {
        x: Math.cos(yaw) * side,
        y: nativeHeight + (profile.focusHeight - nativeHeight) * profile.blend,
        z: -Math.sin(yaw) * side,
        fov: profile.baseFov + (profile.fov - profile.baseFov) * profile.blend,
    };
}

/** A compact third-person lens can show the complete avatar closer than the
 * ordinary 1.5–2m fade range. Keep the body solid until it nears the actual lens. */
export function compactTravelAvatarFadeScale(camera?: {
    near?: number;
    travelFraming?: { blend: number };
}) {
    const blend = Math.max(0, Math.min(1, camera?.travelFraming?.blend || 0));
    const nearScale = Math.min(
        1,
        Math.max(0.45, ((camera?.near || 0.1) + 0.15) / 1.5)
    );
    return 1 + (nearScale - 1) * blend;
}

/** Preserve the lobby framing, but reveal the destination along its authored
 * spawn heading. Rotating the whole formation keeps the black-frame handoff
 * continuous on screen, independent of the direction chosen in the lobby. */
export function orientTravelViewToHeading(
    view: LobbyTravelView | undefined,
    heading: number | undefined
): LobbyTravelView | undefined {
    if (!view || !Number.isFinite(heading)) return view;
    const x = view.cameraOffset.x - view.cameraTargetOffset.x;
    const z = view.cameraOffset.z - view.cameraTargetOffset.z;
    const incomingHeading =
        Math.hypot(x, z) > 1e-6 ? Math.atan2(x, z) : view.avatarRotation;
    const delta = heading - incomingHeading;
    const sin = Math.sin(delta),
        cos = Math.cos(delta);
    const rotate = (point: Point): Point => ({
        x: point.x * cos + point.z * sin,
        y: point.y,
        z: point.z * cos - point.x * sin,
    });
    const rotateYaw = (yaw: number) =>
        Math.atan2(Math.sin(yaw + delta), Math.cos(yaw + delta));
    return {
        ...view,
        cameraOffset: rotate(view.cameraOffset),
        cameraTargetOffset: rotate(view.cameraTargetOffset),
        avatarRotation: rotateYaw(view.avatarRotation),
        ...(view.spawnOffset ? { spawnOffset: rotate(view.spawnOffset) } : {}),
        ...(view.peers
            ? {
                  peers: view.peers.map((peer) => ({
                      ...peer,
                      offset: rotate(peer.offset),
                      rotation: rotateYaw(peer.rotation),
                  })),
              }
            : {}),
    };
}

/** Query the destination's collision data, which remains present while render
 * meshes are hidden for assembly. The avatar is never part of this query. */
export function createTravelCameraResolver(
    THREE: any,
    intersect?: (ray: any) => { distance: number } | null | false
) {
    const ray = new THREE.Ray(),
        direction = new THREE.Vector3();
    const right = new THREE.Vector3(),
        up = new THREE.Vector3();
    const origin = new THREE.Vector3();
    const worldUp = new THREE.Vector3(0, 1, 0);
    const safeDistance = (target: Point, position: Point, lens: Lens) => {
        direction.set(
            position.x - target.x,
            position.y - target.y,
            position.z - target.z
        );
        const length = direction.length();
        if (!intersect || length < 1e-6) return length;
        direction.multiplyScalar(1 / length);
        right.crossVectors(direction, worldUp);
        if (right.lengthSq() < 1e-6) right.set(1, 0, 0);
        else right.normalize();
        up.crossVectors(right, direction).normalize();
        const near = Math.max(0.02, lens.near || 0.1);
        const halfY =
            Math.tan((Math.max(1, Math.min(175, lens.fov)) * Math.PI) / 360) *
            near;
        const halfX = halfY * Math.max(0.1, lens.aspect || 1);
        const padding = Math.max(0.1, near * 0.3);
        let distance = length;
        for (const [x, y] of [
            [0, 0],
            [-1, -1],
            [1, -1],
            [1, 1],
            [-1, 1],
        ]) {
            origin
                .set(target.x, target.y, target.z)
                .addScaledVector(right, x * halfX)
                .addScaledVector(up, y * halfY);
            ray.set(origin, direction);
            const forward = intersect(ray);
            if (
                forward &&
                Number.isFinite(forward.distance) &&
                forward.distance >= 0 &&
                forward.distance <= length
            )
                distance = Math.min(
                    distance,
                    Math.max(0, forward.distance - padding)
                );
            // Native collision triangles can be single-sided. Walk backwards
            // through every hit toward the avatar: the nearest hit from the far
            // endpoint alone can miss another wall closer to the avatar.
            let remaining = Math.min(length, distance);
            for (let step = 0; remaining > 1e-5; step++) {
                if (step === 16) {
                    // Dense/malformed collision meshes must never make a capped
                    // query claim a clear segment it has not finished checking.
                    distance = 0;
                    break;
                }
                ray.origin.copy(origin).addScaledVector(direction, remaining);
                ray.direction.copy(direction).negate();
                const backward = intersect(ray);
                if (
                    !backward ||
                    !Number.isFinite(backward.distance) ||
                    backward.distance < 0 ||
                    backward.distance > remaining
                )
                    break;
                const hitFromTarget = remaining - backward.distance;
                distance = Math.min(
                    distance,
                    Math.max(0, hitFromTarget - padding)
                );
                remaining = hitFromTarget - 1e-5;
            }
        }
        return distance;
    };
    const resolver = {
        safeDistance,
        resolve(
            anchor: Point,
            view: LobbyTravelView,
            lens: Omit<Lens, "fov"> & { allowOrbit?: boolean }
        ): LobbyTravelView {
            const firstPerson = view.cameraMode === "first-person";
            // A first-person lookAt point can lie beyond a wall. It is a viewing
            // direction, never a safe collision origin. Query from avatar eyes.
            const focus = firstPerson
                ? {
                      x: 0,
                      y: view.avatarLift + (view.avatarHeight || 1.8),
                      z: 0,
                  }
                : view.cameraTargetOffset;
            const target = new THREE.Vector3(
                anchor.x + focus.x,
                anchor.y + focus.y,
                anchor.z + focus.z
            );
            const wanted = new THREE.Vector3(
                view.cameraOffset.x - focus.x,
                view.cameraOffset.y - focus.y,
                view.cameraOffset.z - focus.z
            );
            const length = wanted.length();
            if (length < 1e-6)
                return {
                    ...view,
                    cameraOffset: { ...view.cameraOffset },
                    cameraTargetOffset: { ...view.cameraTargetOffset },
                };
            const candidate = new THREE.Vector3(),
                offset = new THREE.Vector3();
            const minimum = Math.min(
                length,
                Math.max(1.1, Math.min(1.8, (view.avatarHeight || 1.8) * 0.8))
            );
            let best: any,
                bestDistance = -1;
            for (const angle of firstPerson || lens.allowOrbit === false
                ? [0]
                : [
                      0,
                      Math.PI / 6,
                      -Math.PI / 6,
                      Math.PI / 3,
                      -Math.PI / 3,
                      Math.PI / 2,
                      -Math.PI / 2,
                      Math.PI,
                  ]) {
                offset.copy(wanted).applyAxisAngle(worldUp, angle);
                candidate.copy(target).add(offset);
                const available = safeDistance(target, candidate, {
                    ...lens,
                    fov: view.fov,
                });
                if (available > bestDistance) {
                    bestDistance = available;
                    best = offset.clone().multiplyScalar(available / length);
                }
                // Prefer a shorter view along the chosen direction. Only rotate
                // around the avatar when a wall makes that framing unusably tight.
                if (available >= minimum) {
                    best = offset.multiplyScalar(available / length);
                    break;
                }
            }
            const cameraOffset = {
                x: focus.x + best.x,
                y: focus.y + best.y,
                z: focus.z + best.z,
            };
            return {
                ...view,
                cameraTargetOffset: firstPerson
                    ? {
                          x:
                              view.cameraTargetOffset.x +
                              cameraOffset.x -
                              view.cameraOffset.x,
                          y:
                              view.cameraTargetOffset.y +
                              cameraOffset.y -
                              view.cameraOffset.y,
                          z:
                              view.cameraTargetOffset.z +
                              cameraOffset.z -
                              view.cameraOffset.z,
                      }
                    : { ...view.cameraTargetOffset },
                cameraOffset,
            };
        },
    };
    return {
        ...resolver,
        /** Select once before reveal. Broad worlds keep their existing framing;
         * tight rooms use a bounded room-facing shoulder view at native size. */
        cinematic(
            anchor: Point,
            incoming: LobbyTravelView,
            lens: Omit<Lens, "fov">,
            native: {
                avatarHeight: number;
                targetHeight: number;
                fov: number;
                radius: number;
                heading: number;
            }
        ): { view: LobbyTravelView; profile?: CompactTravelCameraProfile } {
            if (
                incoming.cameraMode === "first-person" ||
                !Number.isFinite(native.heading) ||
                !(native.avatarHeight > 0)
            )
                return {
                    view: resolver.resolve(anchor, incoming, {
                        ...lens,
                        allowOrbit: false,
                    }),
                };
            const height = native.avatarHeight;
            const pitch = 0.12;
            const makeView = (
                yaw: number,
                target: Point,
                fov: number
            ): LobbyTravelView => ({
                ...incoming,
                avatarHeight: height,
                avatarLift: 0,
                cameraTargetOffset: target,
                cameraOffset: {
                    x:
                        target.x +
                        Math.sin(yaw) * Math.cos(pitch) * native.radius,
                    y: target.y + Math.sin(pitch) * native.radius,
                    z:
                        target.z +
                        Math.cos(yaw) * Math.cos(pitch) * native.radius,
                },
                fov,
            });
            const ordinary = resolver.resolve(
                anchor,
                makeView(
                    native.heading,
                    { x: 0, y: native.targetHeight, z: 0 },
                    native.fov
                ),
                { ...lens, allowOrbit: false }
            );
            const ordinaryDistance = Math.hypot(
                ordinary.cameraOffset.x,
                ordinary.cameraOffset.y - native.targetHeight,
                ordinary.cameraOffset.z
            );
            if (ordinaryDistance >= height * 1.5)
                return {
                    view: resolver.resolve(anchor, incoming, {
                        ...lens,
                        allowOrbit: false,
                    }),
                };
            const probe = new THREE.PerspectiveCamera(
                native.fov,
                lens.aspect,
                lens.near,
                10000
            );
            const point = new THREE.Vector3();
            let best: LobbyTravelView | undefined;
            let bestProfile: CompactTravelCameraProfile | undefined;
            let bestScore = Infinity;
            const maxFov = Math.max(native.fov, 90);
            for (const angle of [
                0,
                Math.PI / 12,
                -Math.PI / 12,
                Math.PI / 6,
                -Math.PI / 6,
            ]) {
                const yaw = native.heading + angle;
                for (const sideRatio of [0.28, -0.28, 0]) {
                    const focusHeight = height * 0.62;
                    const origin = {
                        x: anchor.x,
                        y: anchor.y + focusHeight,
                        z: anchor.z,
                    };
                    const wantedSide = {
                        x: origin.x + Math.cos(yaw) * height * sideRatio,
                        y: origin.y,
                        z: origin.z - Math.sin(yaw) * height * sideRatio,
                    };
                    const availableSide = safeDistance(origin, wantedSide, {
                        ...lens,
                        fov: maxFov,
                    });
                    const side =
                        Math.sign(sideRatio) *
                        Math.min(Math.abs(height * sideRatio), availableSide);
                    const target = {
                        x: Math.cos(yaw) * side,
                        y: focusHeight,
                        z: -Math.sin(yaw) * side,
                    };
                    for (const fov of [native.fov, maxFov]) {
                        const candidate = resolver.resolve(
                            anchor,
                            makeView(yaw, target, fov),
                            { ...lens, allowOrbit: false }
                        );
                        // The shifted target must not bypass a door corner between
                        // the avatar and camera, even when the orbit ray is clear.
                        const cameraPoint = {
                            x: anchor.x + candidate.cameraOffset.x,
                            y: anchor.y + candidate.cameraOffset.y,
                            z: anchor.z + candidate.cameraOffset.z,
                        };
                        const direct = Math.hypot(
                            cameraPoint.x - origin.x,
                            cameraPoint.y - origin.y,
                            cameraPoint.z - origin.z
                        );
                        if (
                            safeDistance(origin, cameraPoint, {
                                ...lens,
                                fov,
                            }) +
                                1e-4 <
                            direct
                        )
                            continue;
                        probe.position.set(
                            candidate.cameraOffset.x,
                            candidate.cameraOffset.y,
                            candidate.cameraOffset.z
                        );
                        probe.lookAt(
                            new THREE.Vector3(target.x, target.y, target.z)
                        );
                        probe.fov = fov;
                        probe.updateProjectionMatrix();
                        probe.updateMatrixWorld(true);
                        point.set(0, 0, 0).project(probe);
                        if (point.z < -1 || point.z > 1) continue;
                        const footX = point.x,
                            footY = point.y;
                        point.set(0, height, 0).project(probe);
                        if (point.z < -1 || point.z > 1) continue;
                        const occupancy = Math.abs(point.y - footY) / 2;
                        const outside =
                            Math.max(0, Math.abs(footY) - 0.9) +
                            Math.max(0, Math.abs(point.y) - 0.9) +
                            Math.max(0, Math.abs(point.x) - 0.7);
                        const score =
                            outside * 20 +
                            Math.max(0, occupancy - 0.55) * 8 +
                            Math.abs(angle) * 0.35 +
                            Math.abs((point.x + footX) / 2 + 0.25) * 0.35 +
                            (fov - native.fov) * 0.004;
                        if (Number.isFinite(score) && score < bestScore) {
                            bestScore = score;
                            best = candidate;
                            bestProfile = {
                                avatarHeight: height,
                                focusHeight,
                                sideOffset: side,
                                fov,
                                baseFov: native.fov,
                                blend: 1,
                            };
                        }
                    }
                }
            }
            return best
                ? { view: best, profile: bestProfile }
                : { view: ordinary };
        },
    };
}
