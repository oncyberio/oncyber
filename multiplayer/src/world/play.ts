/**
 * A play zone: a small walled area where the server runs rigid-body physics
 * for one short game. People are capsules the server moves to wherever they
 * already are; things are balls and boxes that fall, get pushed and get hit.
 * The zone owns the truth; clients only draw what it sends.
 *
 * A running game can be changed without starting over. `plan` says whether a
 * new recipe fits the game as it stands: if so `apply` changes it in place,
 * with everything staying where it is. If not, the zone can play its own
 * history backwards (`beginRewind`, `rewindFrames`) to the start of the
 * round, where any recipe is safe to begin from.
 *
 * Everything is in the zone's own space (its centre is 0, 0), so positions
 * fit the 16-bit wire format in ../../protocol/play-zone.
 */
import RAPIER from "@dimforge/rapier3d-deterministic-compat";
import { PLAY_LIMITS, PlayRecipe, PlayPerson, PlayThing, encodeBodies, encodePeople, playBodies } from "../../protocol/play-zone";

export const PLAY_STEP = 1 / 60;
/** A person is a 1.8 m capsule standing on the floor. */
const PERSON_RADIUS = 0.35;
const PERSON_HALF = 0.55;
const PERSON_CENTRE = PERSON_HALF + PERSON_RADIUS;
/** Steps between one person's hits (0.3 s), and before a scored thing is served again (1 s). */
const HIT_COOLDOWN = 18;
const SERVE_DELAY = 60;
const WALL_HEIGHT = 4;
/** A thing this far above its resting height counts as in the air. */
const AIRBORNE = 0.25;
/** A pose is sent again once it moved a centimetre or turned a little. */
const MOVED = 0.01;
const TURNED = 0.02;
/** Something resting against a wall sits a hair into it; that still counts as inside. */
const TOUCHING = 0.05;
/** History keeps a sample every tenth of a second, thinning the older half once it holds this many. */
const HISTORY_EVERY = 6;
const HISTORY_LIMIT = 600;

/** What a new recipe means for a running game: nothing, a change in place, or a rewind to the start first. */
export type PlayChange = "same" | "live" | "reset";

let ready: Promise<void> | null = null;
/** Loads the physics engine once. Call before the first zone. */
export function loadPlayPhysics() {
    return (ready ||= RAPIER.init());
}

function mulberry32(seed: number) {
    let a = seed | 0;
    return () => {
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

interface Person {
    body: RAPIER.RigidBody;
    x: number;
    y: number;
    z: number;
    yaw: number;
    hitAt: number;
}
interface Sample {
    poses: Float32Array;
    people: PlayPerson[];
}

export class PlayZone {
    readonly world: RAPIER.World;
    recipe: PlayRecipe;
    count = 0;
    /** Seven numbers a body: x y z, then the rotation x y z w. */
    poses = new Float32Array(0);
    tick = 0;
    /** Points for side A (x < 0) and side B. */
    readonly points: [number, number] = [0, 0];
    /** True while history plays backwards; the zone does not step. */
    rewinding = false;
    private bodies: RAPIER.RigidBody[] = [];
    private colliders: RAPIER.Collider[] = [];
    private statics: RAPIER.Collider[] = [];
    private sizes: number[] = [];
    private sent = new Float32Array(0);
    private everSent = new Uint8Array(0);
    private refresh = 0;
    private people = new Map<number, Person>();
    private random: () => number;
    /** Floor-touch games: 0 at rest, 1 once someone hit it, 2 once it rose after that hit. Only a 2 can score. */
    private air = new Uint8Array(0);
    /** Step at which a scored thing is served again, or -1. */
    private serveAt = new Int32Array(0);
    private history: Sample[] = [];
    private cursor = -1;

    constructor(recipe: PlayRecipe, readonly seed = 1) {
        if (!ready) throw new Error("Call loadPlayPhysics() first.");
        this.recipe = recipe;
        this.random = mulberry32(seed);
        this.world = new RAPIER.World({ x: 0, y: -recipe.gravity, z: 0 });
        this.world.timestep = PLAY_STEP;
        this.buildArena();
        this.fit(recipe);
        this.read();
        this.record();
    }

    private buildArena() {
        const world = this.world,
            { halfX, halfZ, walls, net } = this.recipe.arena;
        for (const collider of this.statics) world.removeCollider(collider, false);
        const statics = (this.statics = [
            world.createCollider(
                RAPIER.ColliderDesc.cuboid(halfX + 4, 0.5, halfZ + 4)
                    .setTranslation(0, -0.5, 0)
                    .setFriction(0.8)
            ),
        ]);
        if (walls)
            for (const [x, z, hx, hz] of [
                [halfX + 0.25, 0, 0.25, halfZ + 0.5],
                [-halfX - 0.25, 0, 0.25, halfZ + 0.5],
                [0, halfZ + 0.25, halfX + 0.5, 0.25],
                [0, -halfZ - 0.25, halfX + 0.5, 0.25],
            ])
                statics.push(world.createCollider(RAPIER.ColliderDesc.cuboid(hx, WALL_HEIGHT / 2, hz).setTranslation(x, WALL_HEIGHT / 2, z)));
        if (net) statics.push(world.createCollider(RAPIER.ColliderDesc.cuboid(0.05, net / 2, halfZ).setTranslation(0, net / 2, 0)));
    }

    /**
     * Makes the bodies match a recipe's list: existing ones keep their place
     * and take the new bounce and weight, missing ones are created at their
     * start, and any past the end are removed.
     */
    private fit(recipe: PlayRecipe) {
        const world = this.world,
            before = this.count;
        let index = 0;
        for (const thing of recipe.things) {
            for (let i = 0; i < thing.count; i++, index++) {
                if (index < before) {
                    this.colliders[index].setRestitution(thing.bounce);
                    this.colliders[index].setDensity(thing.weight);
                    continue;
                }
                const [x, y, z] = this.start(index, thing, i, recipe);
                // Fast, small things would tunnel through walls and people without continuous collision.
                const body = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(x, y, z).setLinearDamping(0.3).setAngularDamping(0.6).setCcdEnabled(true).setCanSleep(true));
                const shape = thing.kind === "box" ? RAPIER.ColliderDesc.cuboid(thing.size, thing.size, thing.size) : RAPIER.ColliderDesc.ball(thing.size);
                this.colliders.push(world.createCollider(shape.setRestitution(thing.bounce).setFriction(0.5).setDensity(thing.weight), body));
                this.bodies.push(body);
                this.sizes.push(thing.size);
            }
        }
        for (let i = this.bodies.length - 1; i >= index; i--) world.removeRigidBody(this.bodies[i]);
        this.bodies.length = this.colliders.length = this.sizes.length = this.count = index;
        const keep = Math.min(before, index);
        const grow = <T extends Float32Array | Uint8Array | Int32Array>(old: T, next: T, per: number) => {
            next.set(old.subarray(0, keep * per) as any);
            return next;
        };
        this.poses = grow(this.poses, new Float32Array(index * 7), 7);
        this.sent = grow(this.sent, new Float32Array(index * 7), 7);
        this.everSent = grow(this.everSent, new Uint8Array(index), 1);
        this.air = grow(this.air, new Uint8Array(index), 1);
        this.serveAt = grow(this.serveAt, new Int32Array(index).fill(-1), 1);
    }

    /**
     * Where a thing starts. It depends only on the seed and the thing's own
     * number, so the things two recipes share start in the same places: a
     * round restarted with one more ball looks the same up to that ball.
     */
    private start(index: number, thing: PlayThing, i: number, recipe: PlayRecipe): [number, number, number] {
        const { halfX, halfZ } = recipe.arena,
            r = mulberry32(this.seed ^ Math.imul(index + 1, 0x9e3779b1)),
            margin = thing.size + 0.3;
        // Later things start higher, so a big batch rains down instead of spawning inside itself.
        const height = 2 + r() * Math.min(12, 2 + i * thing.size * 0.16);
        if (thing.drop === "center") return [(r() - 0.5) * 1.5, 2.5 + i * thing.size * 2.2, (r() - 0.5) * 1.5];
        const z = (r() * 2 - 1) * (halfZ - margin);
        if (thing.drop === "sides") {
            const side = i % 2 ? 1 : -1;
            return [side * (margin + r() * (halfX - margin * 2)), height, z];
        }
        return [(r() * 2 - 1) * (halfX - margin), height, z];
    }

    /**
     * Whether a new recipe can take over the game as it stands. It can when
     * the things both recipes share are the same kind and size, and the new
     * arena and net hold everyone and everything where they are now.
     * Gravity, bounce, weight, hits, scoring, time, colours and things added
     * or removed at the end of the list never need a reset.
     */
    plan(next: PlayRecipe): PlayChange {
        if (JSON.stringify(next) === JSON.stringify(this.recipe)) return "same";
        const after = playBodies(next),
            shared = Math.min(this.count, after.length);
        const before = playBodies(this.recipe);
        for (let i = 0; i < shared; i++) if (before[i].kind !== after[i].kind || before[i].size !== after[i].size) return "reset";
        const { halfX, halfZ, walls, net } = next.arena,
            taller = net > this.recipe.arena.net;
        for (let i = 0; i < shared; i++) {
            const p = i * 7,
                x = this.poses[p],
                size = this.sizes[i];
            if (walls && (Math.abs(x) > halfX - size + TOUCHING || Math.abs(this.poses[p + 2]) > halfZ - size + TOUCHING)) return "reset";
            // A net that appears or grows must not cut through a thing.
            if (taller && Math.abs(x) < size + 0.06 && this.poses[p + 1] - size < net) return "reset";
        }
        for (const person of this.people.values()) {
            if (walls && (Math.abs(person.x) > halfX - PERSON_RADIUS + TOUCHING || Math.abs(person.z) > halfZ - PERSON_RADIUS + TOUCHING)) return "reset";
            if (taller && Math.abs(person.x) < PERSON_RADIUS + 0.06) return "reset";
        }
        return "live";
    }

    /** Changes the running game to a recipe that `plan` called "live". Nothing moves because of it. */
    apply(next: PlayRecipe) {
        this.recipe = next;
        this.world.gravity = { x: 0, y: -next.gravity, z: 0 };
        this.buildArena();
        this.fit(next);
        // Resting things would otherwise sleep through a change in gravity or a wall that left.
        for (const body of this.bodies) body.wakeUp();
        this.read();
    }

    /** Places a person where the lobby says they are. Returns false once the zone is full. */
    setPerson(id: number, x: number, y: number, z: number, yaw: number) {
        let person = this.people.get(id);
        if (!person) {
            if (this.people.size >= PLAY_LIMITS.people) return false;
            const body = this.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(x, y + PERSON_CENTRE, z));
            this.world.createCollider(RAPIER.ColliderDesc.capsule(PERSON_HALF, PERSON_RADIUS).setFriction(0.2), body);
            person = { body, x, y, z, yaw, hitAt: -HIT_COOLDOWN };
            this.people.set(id, person);
        }
        person.x = x;
        person.y = y;
        person.z = z;
        person.yaw = yaw;
        return true;
    }
    removePerson(id: number) {
        const person = this.people.get(id);
        if (!person) return;
        this.world.removeRigidBody(person.body);
        this.people.delete(id);
    }

    /**
     * A person hits the things in front of them: each one leaves at the
     * recipe's speed, along where the person faces, tilted up by `lift`.
     * Setting the speed (not adding to it) keeps a hit predictable whatever
     * the thing was doing. Returns how many things were hit.
     */
    hit(id: number) {
        const rule = this.recipe.hit,
            person = this.people.get(id);
        if (this.rewinding || !rule || !person || this.tick - person.hitAt < HIT_COOLDOWN) return 0;
        person.hitAt = this.tick;
        const fx = Math.sin(person.yaw),
            fz = Math.cos(person.yaw);
        // Reach is measured from chest height, a little in front.
        const cx = person.x + fx * 0.5,
            cy = person.y + 1.2,
            cz = person.z + fz * 0.5;
        const flat = Math.sqrt(1 - rule.lift * rule.lift);
        let hits = 0;
        for (let i = 0; i < this.count; i++) {
            const p = i * 7,
                dx = this.poses[p] - cx,
                dy = this.poses[p + 1] - cy,
                dz = this.poses[p + 2] - cz;
            if (dx * dx + dy * dy + dz * dz > (rule.reach + this.sizes[i]) ** 2) continue;
            const body = this.bodies[i];
            body.setLinvel({ x: fx * flat * rule.power, y: rule.lift * rule.power, z: fz * flat * rule.power }, true);
            this.air[i] = 1;
            hits++;
        }
        return hits;
    }

    /** One fixed step of 1/60 s. Does nothing while rewinding. */
    step() {
        if (this.rewinding) return;
        for (const person of this.people.values()) person.body.setNextKinematicTranslation({ x: person.x, y: person.y + PERSON_CENTRE, z: person.z });
        this.world.step();
        this.tick++;
        this.read();
        this.referee();
        if (this.tick % HISTORY_EVERY === 0) this.record();
    }

    private read() {
        for (let i = 0; i < this.count; i++) {
            const body = this.bodies[i];
            if (body.isSleeping() && this.tick) continue;
            const t = body.translation(),
                q = body.rotation(),
                p = i * 7;
            this.poses[p] = t.x;
            this.poses[p + 1] = t.y;
            this.poses[p + 2] = t.z;
            this.poses[p + 3] = q.x;
            this.poses[p + 4] = q.y;
            this.poses[p + 5] = q.z;
            this.poses[p + 6] = q.w;
        }
    }

    private listPeople() {
        const people: PlayPerson[] = [];
        for (const [id, person] of this.people) people.push({ id, x: person.x, y: person.y, z: person.z, yaw: person.yaw });
        return people;
    }

    /** Keeps where everything is now. Old samples thin out so the history always reaches back to the start. */
    private record() {
        this.history.push({ poses: this.poses.slice(), people: this.listPeople() });
        if (this.history.length <= HISTORY_LIMIT) return;
        const half = this.history.length >> 1;
        // Drop every other sample of the older half, never the first.
        this.history = this.history.filter((_, i) => i === 0 || i >= half || i % 2 === 0);
    }

    /**
     * Starts playing the round backwards. Returns how many samples there are
     * to play, so the caller can pick a stride that makes it last as long as
     * it wants.
     */
    beginRewind() {
        if (!this.rewinding) {
            this.record();
            this.rewinding = true;
            this.cursor = this.history.length - 1;
        }
        return this.history.length;
    }

    /**
     * The next moment of the rewind, `stride` samples further back: frames
     * for the things that moved, and where the people were. Null once the
     * start of the round has been shown; the zone is then spent, and a new
     * one with the same seed begins exactly where this one ended.
     */
    rewindFrames(stride = 1): { frames: Uint8Array[]; people: PlayPerson[] } | null {
        if (!this.rewinding || this.cursor <= 0) return null;
        this.cursor = Math.max(0, this.cursor - Math.max(1, Math.floor(stride)));
        const sample = this.history[this.cursor];
        // Things added during the round are missing from older samples and stay where they first were.
        this.poses.set(sample.poses.subarray(0, Math.min(sample.poses.length, this.poses.length)));
        return { frames: this.frames(this.count), people: sample.people };
    }

    /** Scores floor touches, serves scored things again and brings back anything that left the arena. */
    private referee() {
        const { halfX, halfZ } = this.recipe.arena,
            touch = this.recipe.score === "floor-touch";
        for (let i = 0; i < this.count; i++) {
            const p = i * 7,
                x = this.poses[p],
                y = this.poses[p + 1],
                z = this.poses[p + 2],
                rest = this.sizes[i];
            if (this.serveAt[i] >= 0) {
                if (this.tick >= this.serveAt[i]) this.serve(i);
                continue;
            }
            if (y < -5 || Math.abs(x) > halfX + 3 || Math.abs(z) > halfZ + 3) {
                this.serve(i);
                continue;
            }
            if (!touch) continue;
            if (this.air[i] === 1 && y > rest + AIRBORNE) this.air[i] = 2;
            else if (this.air[i] === 2 && y <= rest + 0.05) {
                // Landed after a hit: a point for the side it did not land on.
                this.air[i] = 0;
                this.points[x < 0 ? 1 : 0]++;
                this.serveAt[i] = this.tick + SERVE_DELAY;
            }
        }
    }

    /** Puts a thing back above the middle, towards the side that last lost it. */
    private serve(i: number) {
        const body = this.bodies[i],
            side = this.poses[i * 7] < 0 ? -1 : 1,
            { halfX } = this.recipe.arena;
        body.setTranslation({ x: side * Math.min(2, halfX / 2), y: 3.5, z: (this.random() - 0.5) * 2 }, true);
        body.setLinvel({ x: 0, y: 0, z: 0 }, true);
        body.setAngvel({ x: 0, y: 0, z: 0 }, true);
        this.serveAt[i] = -1;
        this.air[i] = 0;
    }

    get stepsLeft() {
        return Math.max(0, Math.round(this.recipe.seconds / PLAY_STEP) - this.tick);
    }
    get done() {
        return this.stepsLeft === 0;
    }
    /** The score both sides see. For `side-count`, a side scores the things lying on the other side. */
    score(): [number, number] {
        if (this.recipe.score !== "side-count") return [this.points[0], this.points[1]];
        let onA = 0;
        for (let i = 0; i < this.count; i++) if (this.poses[i * 7] < 0) onA++;
        return [this.count - onA, onA];
    }

    /**
     * Frames for the things that moved since they were last sent, plus a few
     * that did not, so a viewer who missed a frame is corrected within about
     * a second. `budget` caps the bodies in one call; the rest go next time.
     */
    frames(budget = PLAY_LIMITS.frameBodies * 3) {
        const indices: number[] = [];
        for (let i = 0; i < this.count && indices.length < budget; i++) if (this.moved(i)) indices.push(i);
        const spare = Math.min(16, budget - indices.length, this.count);
        for (let n = 0; n < spare; n++) {
            const i = this.refresh++ % this.count;
            if (!indices.includes(i)) indices.push(i);
        }
        return this.pack(indices);
    }
    /** Every thing, for someone who has just arrived. */
    fullFrames() {
        return this.pack(Array.from({ length: this.count }, (_, i) => i));
    }
    peopleFrame() {
        return encodePeople(this.tick, this.listPeople());
    }

    private moved(i: number) {
        if (!this.everSent[i]) return true;
        const p = i * 7;
        for (let k = 0; k < 3; k++) if (Math.abs(this.poses[p + k] - this.sent[p + k]) > MOVED) return true;
        for (let k = 3; k < 7; k++) if (Math.abs(this.poses[p + k] - this.sent[p + k]) > TURNED) return true;
        return false;
    }
    private pack(indices: number[]) {
        for (const i of indices) {
            this.everSent[i] = 1;
            this.sent.set(this.poses.subarray(i * 7, i * 7 + 7), i * 7);
        }
        return encodeBodies(this.tick, indices, this.poses);
    }

    /** A short fingerprint of where everything is, to compare two runs. */
    fingerprint() {
        let hash = 2166136261;
        const view = new Uint8Array(this.poses.buffer);
        for (let i = 0; i < view.length; i++) hash = Math.imul(hash ^ view[i], 16777619);
        return (hash >>> 0).toString(16);
    }

    free() {
        this.world.free();
    }
}
