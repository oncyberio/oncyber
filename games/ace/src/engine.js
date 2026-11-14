import { BALL_RADIUS, COURT, DIFFICULTY, PLAYER } from "./config.js";
import {
    contact,
    createAthlete,
    findIntercept,
    incoming,
    seek,
    steer,
} from "./athlete.js";
import { createBrain, thinkCPU } from "./cpu.js";
import { createBall, predict, STEP, stepBall } from "./physics.js";
import {
    awardPoint,
    createMatch,
    createRally,
    isFault,
    other,
    PLAY_LIMIT,
    pointLabel,
    rallyBounce,
    rallyGone,
    rallyHit,
    serveSide,
    serverXSign,
    serviceBoxSign,
} from "./rules.js";
import {
    gaussian,
    grade,
    rallyTarget,
    serveTarget,
    spoil,
    strike,
} from "./shots.js";

// Renderer-independent match simulation. The game feeds it input once per
// frame and drains `events` to drive animation, sound and HUD.

const TOSS_SPEED = 5.6;
const TOSS_HEIGHT = 1.35;

export function mulberry32(seed) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

export const EMPTY_INPUT = Object.freeze({
    move: { x: 0, z: 0 },
    aim: { x: 0, y: 0 },
    press: null, // "flat" | "topspin" | "slice" | "lob" | "drop" on the frame a button goes down
    release: false, // a shot button came back up this frame
});

/**
 * Serve gauge level for a hit `t` seconds after the toss: fills as the ball
 * rises, peaks at the top of the toss, drains as it falls. It is the serve's
 * quality; power follows from it.
 */
export function serveGaugeAt(t) {
    return Math.max(0, 1 - Math.abs(t - TOSS_APEX) / SERVE_WINDOW);
}
const SERVE_WINDOW = 0.34;

export function createEngine({
    difficulty = "pro",
    games = 2,
    seed = Date.now(),
    autoHuman = false,
} = {}) {
    const rng = mulberry32(seed);
    const engine = {
        rng,
        time: 0,
        freeze: 0,
        match: createMatch(games),
        difficulty: DIFFICULTY[difficulty] || DIFFICULTY.pro,
        ball: createBall(),
        athletes: [createAthlete(0), createAthlete(1)],
        brain: null,
        // When autoHuman is set, a second CPU brain plays the near half (tests, attract mode).
        autoBrain: null,
        rally: null,
        phase: "idle", // idle | setup | serve | toss | rally | dead | over
        phaseTime: 0,
        hitCount: 0,
        rallyHits: 0,
        events: [],
        pendingVerdict: null,
        ballVisible: false,
        stillTime: 0,
        plan: null,
        planAt: 0,
        landing: null, // predicted first bounce of a ball coming at the human
        tossAt: 0,
        cpuTossAt: 0,
        serveAim: 0,
    };
    engine.brain = createBrain(engine.difficulty, rng);
    if (autoHuman) engine.autoBrain = createBrain(DIFFICULTY.pro, rng);
    return engine;
}

function emit(engine, type, data = {}) {
    engine.events.push({ type, t: engine.time, ...data });
}

function setPhase(engine, phase) {
    engine.phase = phase;
    engine.phaseTime = 0;
}

export function startMatch(engine) {
    engine.match = createMatch(engine.match.gamesToWin);
    setupPoint(engine);
}

export function setupPoint(engine) {
    const m = engine.match;
    engine.rally = createRally(m);
    engine.rallyHits = 0;
    engine.pendingVerdict = null;
    engine.landing = null;
    engine.ballVisible = true;
    engine.stillTime = 0;
    const server = engine.athletes[m.server];
    const receiver = engine.athletes[other(m.server)];
    const sx = serverXSign(m);
    server.x = sx * 0.9;
    server.z = server.side * (COURT.halfLength + 0.35);
    // The receiver stands diagonally opposite, a step behind the baseline.
    receiver.x = -sx * 2.3;
    receiver.z = receiver.side * (COURT.halfLength + 0.4);
    for (const a of engine.athletes) {
        a.vx = a.vz = a.speed = 0;
        a.state = "ready";
        a.pending = null;
        a.charge = 0;
        a.swing = null;
        a.stateTime = 0;
    }
    holdBallForServe(engine);
    engine.cpuTossAt = 0;
    setPhase(engine, "setup");
    emit(engine, "setup", {
        server: m.server,
        side: serveSide(m),
        second: m.faults > 0,
        label: pointLabel(m),
    });
}

function holdBallForServe(engine) {
    const server = engine.athletes[engine.match.server];
    const ball = engine.ball;
    ball.held = true;
    ball.v = { x: 0, y: 0, z: 0 };
    ball.p = {
        x: server.x - server.right * 0.28,
        y: 1.0,
        z: server.z + server.dir * 0.25,
    };
    ball.bounces = 0;
    ball.spinAccel = 0;
    ball.shot = "serve";
}

function toss(engine) {
    const server = engine.athletes[engine.match.server];
    const ball = engine.ball;
    ball.held = false;
    ball.p = {
        x: server.x + server.right * 0.12,
        y: TOSS_HEIGHT,
        z: server.z + server.dir * 0.32,
    };
    ball.v = { x: 0, y: TOSS_SPEED, z: 0 };
    ball.spinAccel = 0;
    ball.bounces = 0;
    ball.netTouched = false;
    engine.tossAt = engine.time;
    server.state = "toss";
    server.stateTime = 0;
    setPhase(engine, "toss");
    emit(engine, "toss", { who: server.who });
}

export const TOSS_APEX = TOSS_SPEED / 9.81;

function serveHit(engine, shotName, quality, aimX, power) {
    const m = engine.match;
    const server = engine.athletes[m.server];
    const ball = engine.ball;
    const target = serveTarget(
        server,
        serviceBoxSign(m),
        { x: aimX, y: 0 },
        quality,
        engine.rng
    );
    const from = { ...ball.p };
    const kind = shotName === "slice" ? "slice" : "serve";
    strike(
        ball,
        from,
        target,
        kind,
        kind === "slice" ? 0.55 + power * 0.45 : power
    );
    server.state = "swing";
    server.stateTime = 0;
    server.swing = { kind: "serve", shot: kind, t: 0, grade: grade(quality) };
    engine.hitCount += 1;
    rallyHit(engine.rally, server.who);
    const g = grade(quality);
    if (g === "perfect") {
        m.stats[server.who].perfects += 1;
        engine.freeze = 0.085;
    }
    setPhase(engine, "rally");
    emit(engine, "hit", {
        who: server.who,
        shot: kind,
        grade: g,
        power,
        serve: true,
        x: from.x,
        y: from.y,
        z: from.z,
        target,
    });
}

/** How hard was the ball we're about to hit? 0 easy .. ~1 brutal. */
function pressureOn(engine, info) {
    const last = engine.lastShot || { grade: "nice", power: 0.4 };
    return (
        (last.grade === "perfect" ? 0.35 : last.grade === "great" ? 0.15 : 0) +
        last.power * 0.15 +
        (info.stretch ? 0.3 : 0) +
        (1 - info.sweet) * 0.2
    );
}

function rallyStrike(
    engine,
    ath,
    info,
    shotName,
    power,
    quality,
    error = null
) {
    const ball = engine.ball;
    let shot = shotName;
    let p = power;
    let q = quality;
    if (info.stretch) {
        shot = shotName === "lob" ? "lob" : "stretch";
        p = Math.min(p, 0.35);
        q = Math.min(q, 0.55);
    }
    if (info.kind === "smash" && shot !== "lob") {
        shot = "topspin";
        p = Math.max(p, 0.9);
    }
    const aim = ath.who === 0 ? engine.humanAim : ath.aim;
    const target = rallyTarget(ath, shot, aim, p, q, engine.rng);
    const from = { x: ball.p.x, y: Math.max(ball.p.y, 0.25), z: ball.p.z };
    const g0 = grade(q);
    const opts = { timeScale: g0 === "perfect" ? 0.86 : 1 };
    if (error === "net") {
        opts.clear = -0.45;
        opts.timeScale = 0.8;
    } else if (error) spoil(target, ath, error, engine.rng);
    strike(ball, from, target, shot, p, opts);
    engine.lastShot = { grade: g0, power: p, shot };
    const verdict = rallyHit(engine.rally, ath.who);
    engine.hitCount += 1;
    engine.rallyHits += 1;
    const g = grade(q);
    ath.state = "swing";
    ath.stateTime = 0;
    ath.swing = {
        kind: info.kind,
        shot,
        t: 0,
        grade: g,
        stretch: info.stretch,
    };
    ath.pending = null;
    ath.charge = 0;
    if (g === "perfect") {
        engine.match.stats[ath.who].perfects += 1;
        engine.freeze = info.kind === "smash" ? 0.12 : 0.085;
    }
    emit(engine, "hit", {
        who: ath.who,
        shot,
        grade: g,
        power: p,
        kind: info.kind,
        stretch: info.stretch,
        x: from.x,
        y: from.y,
        z: from.z,
        target,
    });
    if (verdict) decide(engine, verdict);
}

/** CPU unforced errors grow with the pressure of the incoming ball. */
function cpuError(engine, d, info) {
    const p = d.unforced + pressureOn(engine, info) * d.pressure;
    const r = engine.rng();
    if (r >= p) return null;
    const k = engine.rng();
    return k < 0.45 ? "long" : k < 0.8 ? "wide" : "net";
}

function decide(engine, verdict) {
    if (engine.pendingVerdict) return;
    engine.pendingVerdict = verdict;
    setPhase(engine, "dead");
    const m = engine.match;
    if (
        engine.rally.serving &&
        engine.ball.netTouched &&
        verdict.reason === "ace" &&
        engine.rally.hits === 1
    ) {
        // Clipped the tape and landed in: let, replay the serve.
        verdict.reason = "let";
    }
    emit(engine, "verdict", {
        ...verdict,
        rallyHits: engine.rallyHits,
        faults: m.faults,
    });
}

function resolveDead(engine) {
    const m = engine.match;
    const v = engine.pendingVerdict;
    engine.pendingVerdict = null;
    if (v.reason === "let") {
        setupPoint(engine);
        return;
    }
    if (isFault({ reason: v.reason })) {
        m.stats[m.server].faults += 1;
        if (m.faults === 0) {
            m.faults = 1;
            setupPoint(engine);
            return;
        }
        v.reason = "double-fault";
    }
    if (v.reason === "ace") m.stats[v.winner].aces += 1;
    if (v.reason === "winner") m.stats[v.winner].winners += 1;
    m.longestRally = Math.max(m.longestRally, engine.rallyHits);
    const result = awardPoint(m, v.winner);
    emit(engine, "point", {
        winner: v.winner,
        reason: v.reason,
        ...result,
        label: pointLabel(m),
        games: [...m.games],
    });
    if (result.match) {
        setPhase(engine, "over");
        for (const a of engine.athletes) {
            a.state = a.who === result.gameWinner ? "celebrate" : "sad";
            a.stateTime = 0;
        }
        emit(engine, "match", { winner: result.gameWinner });
        return;
    }
    engine.betweenPoints = result.game ? 2.1 : 1.15;
    // A quick fist pump for the winner, a slump for the loser.
    for (const a of engine.athletes) {
        a.state = a.who === v.winner ? "celebrate" : "sad";
        a.stateTime = 0;
    }
    setPhase(engine, "between");
}

/** Human footwork with a gentle magnet toward the planned contact spot. */
function driveHuman(engine, input, dt) {
    const ath = engine.athletes[0];
    const ball = engine.ball;
    const coming =
        engine.phase === "rally" &&
        incoming(ath, ball) &&
        engine.rally.lastHitter === 1;
    if (coming && engine.time >= engine.planAt) {
        const prediction = predict(ball, 3, 3);
        engine.plan = findIntercept(ath, ball, prediction, {
            speed: PLAYER.speed,
            allowVolley: true,
            mustBounce: engine.rally.serving,
        });
        engine.planAt = engine.time + 0.12;
        const b = prediction.bounces[0];
        engine.landing =
            b && b.z > 0
                ? { x: b.x, z: b.z, t: engine.time + b.t }
                : engine.landing;
    }
    if (!coming) engine.plan = null;
    const charging = !!ath.pending;
    const maxSpeed = PLAYER.speed * (charging ? PLAYER.chargeSpeed + 0.2 : 1);
    let wx = input.move.x;
    let wz = input.move.z;
    const plan = engine.plan;
    if (plan && coming) {
        const toPlan = Math.hypot(plan.standX - ath.x, plan.standZ - ath.z);
        const pull = seek(ath, plan.standX, plan.standZ, maxSpeed);
        const hasInput = Math.hypot(wx, wz) > 0.15;
        let a = charging ? (hasInput ? 0.55 : 0.92) : hasInput ? 0.12 : 0.35;
        if (toPlan > 3.2) a *= 0.4;
        wx = wx * (1 - a) + pull.x * a;
        wz = wz * (1 - a) + pull.z * a;
    }
    steer(ath, wx, wz, maxSpeed, dt);
}

function updateCharge(ath, now) {
    if (ath.pending)
        ath.charge = Math.min(1, (now - ath.pending.at) / PLAYER.maxCharge);
}

/** Advance everything by real `dt` seconds with the human's input. */
export function update(engine, input, dt) {
    engine.events.length = 0;
    if (engine.freeze > 0) {
        engine.freeze -= dt;
        return engine.events;
    }
    const steps = Math.max(1, Math.round(dt / STEP));
    const sub = dt / steps;
    // Edge-triggered input applies once per frame.
    handlePress(engine, input);
    handleRelease(engine, input);
    for (let i = 0; i < steps; i++) tick(engine, input, sub);
    return engine.events;
}

function handlePress(engine, input) {
    const press = input.press;
    if (engine.autoBrain) return;
    if (!press) return;
    const m = engine.match;
    const human = engine.athletes[0];
    if (engine.phase === "serve" && m.server === 0) {
        // Hold to toss; the gauge over the player fills with the ball.
        engine.humanServeShot = press;
        toss(engine);
        return;
    }
    if (engine.phase === "toss" && m.server === 0) {
        humanServe(engine, press, input.aim.x);
        return;
    }
    if (
        engine.phase === "rally" ||
        engine.phase === "between" ||
        engine.phase === "setup"
    ) {
        if (engine.phase !== "rally") return;
        if (human.state === "swing" && human.stateTime < 0.25) return;
        if (!human.pending) {
            human.pending = { shot: press, at: engine.time };
            human.state = "charge";
            human.stateTime = 0;
            emit(engine, "charge", { who: 0, shot: press });
        } else if (human.pending.shot !== press) {
            // Changing your mind keeps the charge.
            human.pending.shot = press;
            emit(engine, "charge", { who: 0, shot: press, change: true });
        }
    }
}

/** Letting go of the button strikes the serve at the gauge's current level. */
function handleRelease(engine, input) {
    if (!input.release || engine.autoBrain) return;
    if (engine.phase !== "toss" || engine.match.server !== 0) return;
    humanServe(engine, engine.humanServeShot, input.aim.x);
}

function humanServe(engine, shot, aimX) {
    if (engine.ball.p.y < 1.45) return;
    const t = engine.time - engine.tossAt;
    const quality = serveGaugeAt(t);
    engine.serveGauge = quality;
    serveHit(engine, shot, quality, aimX, 0.35 + quality * 0.65);
}

function tick(engine, input, dt) {
    engine.time += dt;
    engine.phaseTime += dt;
    const [human, cpu] = engine.athletes;
    const ball = engine.ball;
    const m = engine.match;
    for (const a of engine.athletes) {
        a.stateTime += dt;
        if (a.swing) {
            a.swing.t += dt;
            if (a.swing.t > 0.55) {
                a.swing = null;
                if (a.state === "swing") a.state = "ready";
            }
        }
        updateCharge(a, engine.time);
        a.look.x = ball.p.x;
        a.look.z = ball.p.z;
    }
    engine.humanAim = input.aim;

    switch (engine.phase) {
        case "setup":
            if (engine.phaseTime > 0.75) setPhase(engine, "serve");
            holdBallForServe(engine);
            break;
        case "serve": {
            const server = engine.athletes[m.server];
            if (m.server === 0 && !engine.autoBrain) {
                // Slide along the baseline to pick a serving angle.
                const sx = serverXSign(m);
                steer(human, input.move.x, 0, 3.2, dt);
                const lo = 0.15;
                const hi = 3.2;
                const ax = Math.abs(human.x);
                if (Math.sign(human.x) !== sx || ax < lo) human.x = sx * lo;
                if (ax > hi) human.x = sx * hi;
                human.z = human.side * (COURT.halfLength + 0.35);
            } else {
                if (!engine.cpuTossAt)
                    engine.cpuTossAt = engine.time + 0.7 + engine.rng() * 0.6;
                if (engine.time >= engine.cpuTossAt) toss(engine);
            }
            if (engine.phase === "serve") holdBallForServe(engine);
            settle(engine, server === human ? cpu : human, dt);
            break;
        }
        case "toss": {
            const server = engine.athletes[m.server];
            stepBall(ball, dt);
            const t = engine.time - engine.tossAt;
            const auto = m.server === 1 || engine.autoBrain;
            if (auto) {
                const brain = m.server === 1 ? engine.brain : engine.autoBrain;
                if (!engine.cpuServeAt) {
                    const skill = brain.d.serve;
                    engine.cpuServeAt =
                        engine.tossAt +
                        TOSS_APEX +
                        gaussian(engine.rng) * (1 - skill) * 0.16;
                    engine.cpuServeAim = (engine.rng() - 0.5) * 2;
                    engine.cpuServeShot =
                        engine.rng() < 0.25 ? "slice" : "serve";
                }
                if (engine.time >= engine.cpuServeAt && ball.p.y > 1.45) {
                    const quality = serveGaugeAt(t);
                    const power =
                        (0.3 + quality * 0.6) * (0.75 + brain.d.serve * 0.25);
                    engine.cpuServeAt = 0;
                    serveHit(
                        engine,
                        engine.cpuServeShot,
                        quality,
                        engine.cpuServeAim,
                        power
                    );
                }
            }
            if (engine.phase === "toss" && ball.v.y < 0 && ball.p.y < 1.15) {
                // Missed the toss: catch it and try again, no penalty.
                engine.cpuServeAt = 0;
                server.state = "ready";
                setPhase(engine, "serve");
                engine.cpuTossAt = engine.time + 0.5;
                emit(engine, "retoss", { who: server.who });
            }
            settle(engine, engine.athletes[other(m.server)], dt);
            break;
        }
        case "rally":
            rallyTick(engine, input, dt);
            break;
        case "dead":
            stepBall(ball, dt);
            for (const a of engine.athletes) {
                a.pending = null;
                steer(a, 0, 0, 6, dt);
            }
            if (engine.phaseTime > 1.25) resolveDead(engine);
            break;
        case "between":
            stepBall(ball, dt);
            for (const a of engine.athletes) steer(a, 0, 0, 6, dt);
            if (engine.phaseTime > engine.betweenPoints) setupPoint(engine);
            break;
        case "over":
            stepBall(ball, dt);
            for (const a of engine.athletes) steer(a, 0, 0, 6, dt);
            break;
        default:
            break;
    }
}

/** The non-serving athlete drifts into a ready stance. */
function settle(engine, ath, dt) {
    const target = { x: ath.x, z: ath.z };
    const want = seek(ath, target.x, target.z, 3);
    steer(ath, want.x, want.z, 3, dt);
}

function rallyTick(engine, input, dt) {
    const [human, cpu] = engine.athletes;
    const ball = engine.ball;
    const events = [];
    stepBall(ball, dt, events);
    for (const e of events) {
        if (e.type === "bounce") {
            const verdict = rallyBounce(engine.rally, e.x, e.z);
            emit(engine, "bounce", {
                x: e.x,
                z: e.z,
                speed: e.speed,
                index: e.index,
                out:
                    !!verdict &&
                    (verdict.reason === "out" || verdict.reason === "fault"),
            });
            if (verdict) {
                decide(engine, verdict);
                return;
            }
        } else if (e.type === "net") {
            emit(engine, "net", { cord: e.cord, x: e.x, y: e.y });
        }
    }
    if (
        Math.abs(ball.p.x) > PLAY_LIMIT.x + 4 ||
        Math.abs(ball.p.z) > PLAY_LIMIT.z + 6
    ) {
        const verdict = rallyGone(engine.rally);
        if (verdict) return decide(engine, verdict);
    }
    const slow = Math.hypot(ball.v.x, ball.v.y, ball.v.z) < 0.4;
    engine.stillTime = slow ? engine.stillTime + dt : 0;
    if (engine.stillTime > 0.4) {
        const verdict = rallyGone(engine.rally);
        if (verdict) return decide(engine, verdict);
    }

    // CPU.
    const canHitCpu =
        engine.rally.lastHitter === 0 &&
        !(engine.rally.serving && ball.bounces === 0);
    engine.brain.mustBounce = engine.rally.serving;
    if (engine.autoBrain) engine.autoBrain.mustBounce = engine.rally.serving;
    const think = thinkCPU(
        engine.brain,
        cpu,
        human,
        ball,
        engine.hitCount,
        engine.time,
        dt,
        true
    );
    if (think.wantSwing && canHitCpu) {
        const info = contact(cpu, ball, engine.difficulty.reach);
        if (info) {
            const next = engine.brain.nextShot || {
                shot: "topspin",
                aim: { x: 0, y: 0 },
                power: 0.5,
            };
            cpu.aim = next.aim;
            const skill = 1 - engine.difficulty.error / 1.4;
            const quality = Math.max(
                0,
                Math.min(
                    1,
                    info.sweet * 0.5 + skill * 0.45 + (engine.rng() - 0.5) * 0.3
                )
            );
            rallyStrike(
                engine,
                cpu,
                info,
                next.shot,
                next.power,
                quality,
                cpuError(engine, engine.difficulty, info)
            );
            if (engine.phase !== "rally") return;
        }
    }

    // Human (or the attract-mode bot).
    const canHitHuman =
        engine.rally.lastHitter === 1 &&
        !(engine.rally.serving && ball.bounces === 0);
    if (engine.autoBrain) {
        const think2 = thinkCPU(
            engine.autoBrain,
            human,
            cpu,
            ball,
            engine.hitCount,
            engine.time,
            dt,
            true
        );
        if (think2.wantSwing && canHitHuman) {
            const info = contact(human, ball, DIFFICULTY.pro.reach);
            if (info) {
                const next = engine.autoBrain.nextShot || {
                    shot: "topspin",
                    aim: { x: 0, y: 0 },
                    power: 0.5,
                };
                human.aim = next.aim;
                engine.humanAim = next.aim;
                const quality = Math.max(
                    0,
                    Math.min(
                        1,
                        info.sweet * 0.5 + 0.4 + (engine.rng() - 0.5) * 0.3
                    )
                );
                rallyStrike(
                    engine,
                    human,
                    info,
                    next.shot,
                    next.power,
                    quality,
                    cpuError(engine, DIFFICULTY.pro, info)
                );
            }
        }
        return;
    }
    driveHuman(engine, input, dt);
    if (human.pending && canHitHuman) {
        const info = contact(human, ball, PLAYER.reach);
        if (info) {
            const quality = Math.max(
                0,
                Math.min(1, info.sweet * 0.5 + human.charge * 0.5)
            );
            const power = 0.2 + human.charge * 0.8;
            rallyStrike(
                engine,
                human,
                info,
                human.pending.shot,
                power,
                quality
            );
            return;
        }
    }
    // Whiff: the ball got behind us while armed.
    if (human.pending && canHitHuman) {
        const behind = (ball.p.z - human.z) * human.dir < -1.0;
        if (behind && ball.p.y < 2.5) {
            human.pending = null;
            human.charge = 0;
            human.state = "swing";
            human.stateTime = 0;
            const lateral = (ball.p.x - human.x) * human.right;
            human.swing = {
                kind: lateral >= 0 ? "forehand" : "backhand",
                shot: "topspin",
                t: 0,
                grade: "miss",
            };
            emit(engine, "whiff", { who: 0 });
        }
    }
}

export { BALL_RADIUS };
