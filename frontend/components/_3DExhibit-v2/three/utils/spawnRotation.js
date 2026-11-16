// @ts-check

import { Euler, Quaternion } from "three"

const HALF_PI = Math.PI / 2

/**
 * A spawn's rotation as the camera starts with it.
 *
 * Studio's spawn marker is rotated with three's default XYZ order. Once its
 * heading passes ±90°, three writes that same upright heading as
 * (±π, θ, ±π). The camera reads x as its pitch, so such a spawn opened
 * looking straight down or straight up. A rotation like that is turned back
 * into the heading the marker shows, with no pitch or roll; every other
 * rotation is kept as saved.
 *
 * @param {{ x?: number, y?: number, z?: number } | null | undefined} rotation
 * @returns { Euler }
 */
export function spawnCameraRotation(rotation) {

    const x = rotation?.x || 0

    const y = rotation?.y || 0

    const z = rotation?.z || 0

    if (Math.abs(x) <= HALF_PI && Math.abs(z) <= HALF_PI) {

        return new Euler(x, y, z)
    }

    const heading = new Euler().setFromQuaternion(
        new Quaternion().setFromEuler(new Euler(x, y, z, "XYZ")),
        "YXZ"
    )

    return new Euler(heading.x, heading.y, 0)
}
