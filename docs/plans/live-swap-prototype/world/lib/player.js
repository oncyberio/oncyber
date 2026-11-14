// Movement rules: a pure step over plain data, driven only by declared input.
const JUMP = 7, GRAVITY = 20;

export const initialPlayer = () => ({ x: 0, y: 0, z: 0, vy: 0, grounded: true, maxY: 0, jumps: 0 });

export function stepPlayer(p, input, pressed, dt, params) {
    const speed = params.speed ?? 6;
    p.x += (input.moveX || 0) * speed * dt;
    p.z += (input.moveZ || 0) * speed * dt;
    if (pressed.jump && p.grounded) { p.vy = JUMP; p.grounded = false; p.jumps++; }
    p.vy -= GRAVITY * dt;
    p.y += p.vy * dt;
    if (p.y <= 0) { p.y = 0; p.vy = 0; p.grounded = true; }
    if (p.y > p.maxY) p.maxY = p.y;
}
