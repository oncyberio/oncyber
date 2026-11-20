"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ACTION_REST = exports.ACTION_LIMITS = exports.ACTION_PARTS = void 0;
exports.readPlayAction = readPlayAction;

// An action is how a person moves for a moment: a hit, a throw, a dodge. It
// is not a recorded animation. It is a handful of moments, each saying where
// the hands, feet and hips should be, and the body works out the rest. That
// keeps an action to a few hundred bytes, lets a hand go to wherever the
// ball really is, and lets a model write one from a description.
//
// Positions are in the person's own space, in metres, for a body 1.8 m
// tall: x to their right, y up from the floor, z the way they face.
// Like recipes, an action is data, never code: readPlayAction clamps
// everything, so one from a prompt is safe to play.

/** What a moment may place: four limbs by position, the hips by position, and two turns of the torso in degrees. */
const ACTION_PARTS = Object.freeze(["rightHand", "leftHand", "rightFoot", "leftFoot", "hips", "lean", "twist"]);
exports.ACTION_PARTS = ACTION_PARTS;

/** Standing still. A part an action never mentions stays here; every action starts and ends here. */
const ACTION_REST = Object.freeze({
    rightHand: Object.freeze([0.26, 0.86, 0.04]),
    leftHand: Object.freeze([-0.26, 0.86, 0.04]),
    rightFoot: Object.freeze([0.11, 0, 0]),
    leftFoot: Object.freeze([-0.11, 0, 0]),
    hips: Object.freeze([0, 0.95, 0]),
    lean: 0,
    twist: 0,
});
exports.ACTION_REST = ACTION_REST;

const ACTION_LIMITS = Object.freeze({
    seconds: [0.2, 3],
    moments: 8,
    /** [low, high] for x, y and z. Wider than the body can reach; the body stops at full stretch. */
    hand: [
        [-1.1, 1.1],
        [0, 2.4],
        [-0.9, 1.2],
    ],
    foot: [
        [-0.9, 0.9],
        [0, 1.3],
        [-1, 1],
    ],
    hips: [
        [-0.6, 0.6],
        [0.3, 1.5],
        [-0.6, 0.6],
    ],
    /** Forward bend of the torso, and its turn to the left, in degrees. */
    lean: [-40, 70],
    twist: [-80, 80],
});
exports.ACTION_LIMITS = ACTION_LIMITS;

const EASES = ["in-out", "in", "out", "linear"];
const clamp = (value, [low, high]) => Math.min(high, Math.max(low, value));
const finite = (value) => typeof value === "number" && Number.isFinite(value);
const point = (value, box) => (Array.isArray(value) && value.length === 3 && value.every(finite) ? value.map((v, axis) => +clamp(v, box[axis]).toFixed(3)) : null);

/** An action with every number inside its limits and its moments in order, or null when there is nothing to play. */
function readPlayAction(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const input = value;
    const moments = [];
    for (const raw of Array.isArray(input.moments) ? input.moments.slice(0, 32) : []) {
        if (!raw || typeof raw !== "object" || !finite(raw.at)) continue;
        const moment = { at: +clamp(raw.at, [0, 1]).toFixed(3), ease: EASES.includes(raw.ease) ? raw.ease : "in-out" };
        let places = 0;
        for (const part of ["rightHand", "leftHand"]) {
            // "target" sends that hand to the thing being hit, wherever it is.
            const at = raw[part] === "target" ? "target" : point(raw[part], ACTION_LIMITS.hand);
            if (at) (moment[part] = at), places++;
        }
        for (const part of ["rightFoot", "leftFoot"]) {
            const at = point(raw[part], ACTION_LIMITS.foot);
            if (at) (moment[part] = at), places++;
        }
        const hips = point(raw.hips, ACTION_LIMITS.hips);
        if (hips) (moment.hips = hips), places++;
        for (const part of ["lean", "twist"]) if (finite(raw[part])) (moment[part] = +clamp(raw[part], ACTION_LIMITS[part]).toFixed(1)), places++;
        if (places) moments.push(moment);
    }
    if (!moments.length) return null;
    moments.sort((a, b) => a.at - b.at);
    const name =
        typeof input.name === "string"
            ? input.name
                  .toLowerCase()
                  .replace(/[^a-z0-9]+/g, "-")
                  .replace(/^-+|-+$/g, "")
                  .slice(0, 40)
            : "";
    // The instant the hit lands, as a share of the action. Without one, the first moment that reaches for the target.
    const reaching = moments.find((moment) => moment.rightHand === "target" || moment.leftHand === "target");
    const contact = finite(input.contact) ? +clamp(input.contact, [0, 1]).toFixed(3) : reaching ? reaching.at : null;
    return { name: name || "action", seconds: +clamp(finite(input.seconds) ? input.seconds : 0.8, ACTION_LIMITS.seconds).toFixed(3), contact, moments: moments.slice(0, ACTION_LIMITS.moments) };
}
