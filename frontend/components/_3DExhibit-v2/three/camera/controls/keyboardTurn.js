import Players from "@3factory/player";

// A quarter turn per second, independent of viewport size and key repeat rate.
const TURN_SPEED = Math.PI / 2;

export function applyKeyboardTurn(controls, deltaTime, orbit = false) {
    const keys = controls.playerState.keyStates;
    const direction = Number(!!keys.ArrowLeft) - Number(!!keys.ArrowRight);
    if (
        !direction ||
        Players.main?.deactivated ||
        !Number.isFinite(deltaTime) ||
        deltaTime <= 0
    )
        return false;

    // Avoid a sudden spin after a suspended tab or a long frame.
    const angle = direction * TURN_SPEED * Math.min(deltaTime, 0.1);
    const camera = controls.camera;

    if (orbit && camera.move) {
        // PlayerCamera.move takes pixels, while theta is stored in degrees.
        camera.move((-angle * (180 / Math.PI) * 2) / camera.sensitivity.x, 0);
    } else {
        controls.targetQuat ||= camera.quaternion.clone();
        controls.euler.setFromQuaternion(controls.targetQuat, "YXZ");
        controls.euler.y += angle;
        controls.targetQuat.setFromEuler(controls.euler);
        camera.quaternion.copy(controls.targetQuat);
        // Walking must follow the new heading in the same frame.
        camera.updateMatrixWorld(true);
    }

    return true;
}
