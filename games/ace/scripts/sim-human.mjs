// Plays the human side through the same input path as the keyboard:
// presses a shot `lead` seconds before the ball reaches the human, and
// optionally steers toward the predicted bounce (a rough "good player").
import { createEngine, startMatch, update } from "../src/engine.js";
import { predict } from "../src/physics.js";

const difficulty = process.argv[2] || "pro";
const lead = Number(process.argv[3] || 0.6);
const steerOn = process.argv[4] !== "nosteer";
let returned = 0,
    chances = 0,
    perfects = 0,
    grades = {};
const reasons = {};
let pointsWon = 0,
    points = 0,
    rallyTotal = 0;
for (let seed = 1; seed <= 6; seed++) {
    const e = createEngine({ seed, difficulty, games: 2 });
    startMatch(e);
    let pressed = -1,
        t = 0,
        served = -1;
    while (e.phase !== "over" && t < 900) {
        let press = null;
        let move = { x: 0, z: 0 };
        const h = e.athletes[0];
        if (e.phase === "serve" && e.match.server === 0 && e.phaseTime > 0.3)
            press = "topspin";
        if (
            e.phase === "toss" &&
            e.match.server === 0 &&
            e.ball.v.y < 0.3 &&
            e.ball.v.y > -0.4
        )
            press = "topspin";
        if (e.phase === "rally" && e.rally.lastHitter === 1 && e.ball.v.z > 0) {
            if (pressed !== e.hitCount) {
                const dz = h.z - e.ball.p.z;
                const tArrive = dz / Math.max(1, e.ball.v.z);
                if (tArrive < lead) {
                    press = "topspin";
                    pressed = e.hitCount;
                    chances++;
                }
            }
            if (steerOn && e.plan) {
                const dx = e.plan.standX - h.x,
                    dz = e.plan.standZ - h.z,
                    d = Math.hypot(dx, dz);
                if (d > 0.3) move = { x: dx / d, z: dz / d };
            }
        }
        for (const ev of update(
            e,
            { move, aim: { x: 0, y: 0 }, press },
            1 / 60
        )) {
            if (ev.type === "hit" && ev.who === 0 && !ev.serve) {
                returned++;
                grades[ev.grade] = (grades[ev.grade] || 0) + 1;
            }
            if (ev.type === "point") {
                points++;
                if (ev.winner === 0) pointsWon++;
            }
            if (ev.type === "verdict") {
                rallyTotal += ev.rallyHits;
                const k = `${ev.winner}:${ev.reason}`;
                reasons[k] = (reasons[k] || 0) + 1;
            }
        }
        t += 1 / 60;
    }
}
console.log({
    avgRally: (rallyTotal / points).toFixed(1),
    difficulty,
    lead,
    steerOn,
    returnRate: (returned / chances).toFixed(2),
    grades,
    pointsWon,
    points,
    reasons,
});
