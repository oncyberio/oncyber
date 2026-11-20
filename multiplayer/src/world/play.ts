/**
 * A play zone: a small walled area where the server runs rigid-body physics
 * for one short game. People are capsules the server moves to wherever they
 * already are; things are balls and boxes that fall, get pushed and get hit.
 * The zone owns the truth; clients only draw what it sends.
 *
 * Everything is in the zone's own space (its centre is 0, 0), so positions
 * fit the 16-bit wire format in ../../protocol/play-zone.
 */
import RAPIER from "@dimforge/rapier3d-deterministic-compat";
import { PLAY_LIMITS, PlayRecipe, PlayPerson, encodeBodies, encodePeople, playBodies } from "../../protocol/play-zone";

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

export class PlayZone {
    readonly world: RAPIER.World;
    readonly count: number;
    /** Seven numbers a body: x y z, then the rotation x y z w. */
    readonly poses: Float32Array;
    tick = 0;
    /** Points for side A (x < 0) and side B. */
    readonly points: [number, number] = [0, 0];
    private bodies: RAPIER.RigidBody[] = [];
    private sizes: number[] = [];
    private sent: Float32Array;
    private everSent: Uint8Array;
    private refresh = 0;
    private people = new Map<number, Person>();
    private random: () => number;
    /** Floor-touch games: 0 at rest, 1 once someone hit it, 2 once it rose after that hit. Only a 2 can score. */
    private air: Uint8Array;
    /** Step at which a scored thing is served again, or -1. */
    private serveAt: Int32Array;

    constructor(readonly recipe: PlayRecipe, seed = 1) {
        if (!ready) throw new Error("Call loadPlayPhysics() first.");
        this.random = mulberry32(seed);
        const { halfX, halfZ, walls, net } = recipe.arena;
        const world = (this.world = new RAPIER.World({ x: 0, y: -recipe.gravity, z: 0 }));
        world.timestep = PLAY_STEP;
        world.createCollider(
            RAPIER.ColliderDesc.cuboid(halfX + 4, 0.5, halfZ + 4)
                .setTranslation(0, -0.5, 0)
                .setFriction(0.8)
        );
        if (walls)
            for (const [x, z, hx, hz] of [
                [halfX + 0.25, 0, 0.25, halfZ + 0.5],
                [-halfX - 0.25, 0, 0.25, halfZ + 0.5],
                [0, halfZ + 0.25, halfX + 0.5, 0.25],
                [0, -halfZ - 0.25, halfX + 0.5, 0.25],
            ])
                world.createCollider(RAPIER.ColliderDesc.cuboid(hx, WALL_HEIGHT / 2, hz).setTranslation(x, WALL_HEIGHT / 2, z));
        if (net) world.createCollider(RAPIER.ColliderDesc.cuboid(0.05, net / 2, halfZ).setTranslation(0, net / 2, 0));

        const list = playBodies(recipe);
        this.count = list.length;
        this.poses = new Float32Array(this.count * 7);
        this.sent = new Float32Array(this.count * 7);
        this.everSent = new Uint8Array(this.count);
        this.air = new Uint8Array(this.count);
        this.serveAt = new Int32Array(this.count).fill(-1);
        let index = 0;
        for (const thing of recipe.things) {
            for (let i = 0; i < thing.count; i++, index++) {
                const [x, y, z] = this.start(thing.drop, thing.size, i, thing.count);
                // Fast, small things would tunnel through walls and people without continuous collision.
                const body = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(x, y, z).setLinearDamping(0.3).setAngularDamping(0.6).setCcdEnabled(true).setCanSleep(true));
                const shape = thing.kind === "box" ? RAPIER.ColliderDesc.cuboid(thing.size, thing.size, thing.size) : RAPIER.ColliderDesc.ball(thing.size);
                world.createCollider(shape.setRestitution(thing.bounce).setFriction(0.5).setDensity(thing.weight), body);
                this.bodies.push(body);
                this.sizes.push(thing.size);
            }
        }
        this.read();
    }

    /** Where a thing starts, by how the recipe drops it. */
    private start(drop: string, size: number, i: number, count: number): [number, number, number] {
        const { halfX, halfZ } = this.recipe.arena,
            r = this.random,
            margin = size + 0.3;
        // Stack higher as the count grows so things rain down instead of spawning inside each other.
        const height = 2 + r() * Math.min(12, 2 + count * size * 0.08);
        if (drop === "center") return [(r() - 0.5) * 1.5, 2.5 + i * size * 2.2, (r() - 0.5) * 1.5];
        const z = (r() * 2 - 1) * (halfZ - margin);
        if (drop === "sides") {
            const side = i % 2 ? 1 : -1;
            return [side * (margin + r() * (halfX - margin * 2)), height, z];
        }
        return [(r() * 2 - 1) * (halfX - margin), height, z];
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
        if (!rule || !person || this.tick - person.hitAt < HIT_COOLDOWN) return 0;
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

    /** One fixed step of 1/60 s. */
    step() {
        for (const person of this.people.values()) person.body.setNextKinematicTranslation({ x: person.x, y: person.y + PERSON_CENTRE, z: person.z });
        this.world.step();
        this.tick++;
        this.read();
        this.referee();
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
        const people: PlayPerson[] = [];
        for (const [id, person] of this.people) people.push({ id, x: person.x, y: person.y, z: person.z, yaw: person.yaw });
        return encodePeople(this.tick, people);
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
