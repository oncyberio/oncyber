import { LobbyInputPrediction } from "./LobbyInputPrediction";
import {
    input,
    state,
    step,
    STEP,
    ACCELERATION,
    advanceVelocity,
    encodeInputs,
    decodeInputs,
} from "../../../multiplayer/protocol/movement";
import { InputAuthority } from "../../../multiplayer/src/world/input";
const controls = input({
    strafe: 0.3,
    forward: -1,
    yaw: 0.7,
    running: true,
    jump: false,
    animation: -1,
});
test("fixed simulation agrees at 30, 60, 144Hz and presentation advances between steps", () => {
    const results = [30, 60, 144].map((hz) => {
        const p = new LobbyInputPrediction();
        for (let f = 0; f < hz; f++) p.advance(1 / hz, controls);
        return p.state;
    });
    expect(results[0]).toEqual(results[1]);
    expect(results[2]).toEqual(results[1]);
    const p = new LobbyInputPrediction();
    p.advance(STEP, controls);
    const before = { ...p.state };
    const shown = p.advance(STEP / 2, controls);
    expect(p.state).toEqual(before);
    expect(shown.z).not.toBe(before.z);
});
test("replays delayed acknowledgments after lost and reordered datagrams without drift", () => {
    const p = new LobbyInputPrediction(),
        server = new InputAuthority({}, 1000);
    const acks: any[] = [];
    let reordered: any;
    for (let f = 1; f <= 300; f++) {
        const c = {
            ...controls,
            jump: f >= 70 && f < 100,
            forward: f > 180 ? 0 : controls.forward,
            strafe: f > 180 ? 0 : controls.strafe,
        };
        p.advance(STEP, c);
        if (f % 3 === 0) {
            const batch = decodeInputs(encodeInputs(p.packet()))!;
            // Three consecutive missing sends: recover 150 ms of input history.
            const burstLoss = f >= 60 && f <= 66;
            if (!burstLoss && f % 15 !== 0) server.receive(batch);
            if (!burstLoss && reordered) server.receive(reordered);
            reordered = burstLoss ? undefined : batch;
        }
        const ack = server.advance(1000 + (f * 1000) / 60);
        if (ack) acks.push({ at: f + 9, ack });
        while (acks[0]?.at <= f)
            expect(p.acknowledge(acks.shift().ack)).toBe(true);
    }
    server.receive(p.packet());
    const final = server.advance(6100)!;
    expect(p.acknowledge(final)).toBe(true);
    expect(p.state).toEqual(server.state);
    expect(p.pending).toBe(0);
    expect(p.correctionDistance).toBeLessThan(0.00001);
    expect(p.replayed).toBeGreaterThan(0);
    expect(p.acknowledge(final)).toBe(false);
});
test("authoritative displacement replays later input and rejects malformed/future acknowledgments", () => {
    const p = new LobbyInputPrediction(),
        base = state();
    for (let f = 0; f < 12; f++) p.advance(STEP, controls);
    for (let f = 0; f < 6; f++) step(base, controls);
    base.x += 1;
    const expected = { ...base };
    for (let f = 0; f < 6; f++) step(expected, controls);
    expect(p.acknowledge({ seq: 6, state: base })).toBe(true);
    expect(p.state).toEqual(expected);
    expect(p.pending).toBe(6);
    expect(p.acknowledge({ seq: 99, state: base })).toBe(false);
    expect(p.acknowledge({ seq: 7, state: { ...base, x: NaN } })).toBe(false);
});
test("sanitizes nonfinite controls and does not repeatedly jump when held", () => {
    const p = new LobbyInputPrediction();
    for (let f = 0; f < 180; f++)
        p.advance(STEP, {
            ...controls,
            strafe: NaN,
            forward: Infinity,
            yaw: Infinity,
            jump: true,
        });
    expect(p.state.y).toBe(0);
    expect(p.state.x).toBe(0);
    expect(p.state.z).toBe(0);
    p.advance(STEP, { ...controls, jump: false });
    p.advance(STEP, { ...controls, jump: true });
    expect(p.state.y).toBeGreaterThan(0);
});

test("prediction and authority preserve double-jump allowance through delayed reconciliation", () => {
    const p = new LobbyInputPrediction(),
        server = new InputAuthority({}, 1000);
    const acks: any[] = [];
    let sawDouble = false;
    for (let frame = 1; frame <= 120; frame++) {
        const command = {
            ...controls,
            jump: frame === 2 || frame === 20 || frame === 25,
        };
        p.advance(STEP, command);
        server.receive(decodeInputs(encodeInputs(p.packet()))!);
        const ack = server.advance(1000 + (frame * 1000) / 60);
        if (ack) acks.push({ at: frame + 4, ack });
        while (acks[0]?.at <= frame)
            expect(p.acknowledge(acks.shift().ack)).toBe(true);
        sawDouble ||= p.state.jumpCount === 2;
        expect(p.state.jumpCount).toBeLessThanOrEqual(2);
    }
    expect(sawDouble).toBe(true);
    expect(p.state).toEqual(server.state);
    expect(p.correctionDistance).toBeLessThan(1e-6);
});

test.each([30, 60, 144])(
    "acceleration is bounded without slowing release braking at %i Hz",
    (hz) => {
        for (const running of [false, true])
            for (const strafe of [0, 1]) {
                const command = input({ ...controls, running, strafe });
                const local = { vx: 0, vz: 0 },
                    predicted = new LobbyInputPrediction();
                for (let f = 0; f < hz * 3; f++) {
                    const previous = Math.hypot(local.vx, local.vz);
                    advanceVelocity(
                        local,
                        command.strafe,
                        command.forward,
                        running,
                        1 / hz
                    );
                    predicted.advance(1 / hz, command);
                    const speed = Math.hypot(local.vx, local.vz);
                    // Bound the feel as well as acceleration: near-full run in
                    // under 0.6s, sprint in under 0.9s, including diagonals.
                    if (f + 1 === Math.ceil(hz * (running ? 0.9 : 0.6)))
                        expect(speed).toBeGreaterThan(
                            (running ? 5.4 : 3.2) * 0.95
                        );
                    expect(speed - previous).toBeLessThanOrEqual(
                        ACCELERATION / hz + 1e-9
                    );
                    expect(speed).toBeGreaterThanOrEqual(previous - 1e-9);
                    // Presentation may be one fixed tick ahead/behind local rendering.
                    expect(
                        Math.abs(
                            speed -
                                Math.hypot(
                                    predicted.state.vx,
                                    predicted.state.vz
                                )
                        )
                    ).toBeLessThan(ACCELERATION / 60 + 0.015);
                }
                expect(Math.hypot(local.vx, local.vz)).toBeCloseTo(
                    running ? 5.4 : 3.2,
                    3
                );
                let drift = 0;
                for (let f = 0; f < Math.ceil(hz * 0.2); f++) {
                    advanceVelocity(local, 0, 0, running, 1 / hz);
                    drift += Math.hypot(local.vx, local.vz) / hz;
                }
                expect(local).toEqual({ vx: 0, vz: 0 });
                expect(drift).toBeLessThan(0.2);
            }
    }
);
