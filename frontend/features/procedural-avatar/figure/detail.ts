/**
 * Detail: which of a mesh's vertices a view can do without.
 *
 * A figure is modelled to be looked at closely. Further off, most of its
 * triangles are smaller than a pixel and the surface they describe could
 * be drawn with far fewer and come out the same on screen. This works out,
 * once, when a figure is built, the order in which its vertices can go and
 * what each going costs: how far, in metres, anything that is drawn ends up
 * from where the whole mesh would have put it. A view then keeps every
 * vertex that costs more than it can show (a fraction of the size of one of
 * its pixels at the figure) and drops the rest.
 *
 * A vertex goes by being folded into a neighbour: every triangle that used
 * it uses the neighbour instead, and those that used both are gone. No
 * vertex moves and none is made, so the coarser meshes are only other lists
 * of triangles over the same vertices: everything the vertices carry
 * (light, bones, expressions) is used as it stands, and what a figure's
 * shaders draw from the resting position stays exactly where it was.
 *
 * What counts towards a vertex's cost is everything that would show:
 *
 * - how far the surface moves, at rest;
 * - how far it would move in an expression, and when a joint bends, where
 *   the vertex and the surface that replaces it follow different bones;
 * - how far its shading changes (which way it faces, the light stored on
 *   it), counted over the patch that changes: a patch turned a tenth of a
 *   radian counts as a tenth of its width.
 *
 * Shared by the tool that builds a figure and the code that draws one, and
 * free of imports for that.
 */

/** A mesh, and what of it is drawn. */
export interface DetailInput {
    /** Where each vertex rests: three numbers a vertex. */
    position: Float32Array;
    indices: ArrayLike<number>;
    /** Which way each vertex faces, for shading. */
    normal?: Float32Array;
    /**
     * What facing a radian another way is worth as a change of shade (1
     * is black to white): 1 if left out.
     */
    turned?: number;
    /**
     * Numbers the vertices carry that are drawn as they are, `width` a
     * vertex. `shade` is what a difference of one is worth as a change of
     * shade (1 is black to white); `place`, in metres, what it is worth
     * as something drawn in another place.
     */
    fields?: {
        data: ArrayLike<number>;
        width: number;
        shade?: number;
        place?: number;
    }[];
    /** Expressions: how far each moves every vertex. */
    morphs?: Float32Array[];
    /** The bones the mesh hangs on. */
    skin?: {
        /** Four bones a vertex, and how much of it each carries. */
        joints: ArrayLike<number>;
        weights: ArrayLike<number>;
        /** Each bone's parent among the bones, or -1. */
        parent: ArrayLike<number>;
        /** Where each bone turns: three numbers a bone. */
        pivot: ArrayLike<number>;
    };
    /** Vertices that must stay, whatever the view: 1 for each. */
    locked?: ArrayLike<number>;
    /**
     * For each vertex, the least its going may cost, metres: for what
     * shows in ways the rest of this does not measure.
     */
    least?: ArrayLike<number>;
    /**
     * For each vertex, how many times over its cost counts: more than
     * once where the mesh will be reshaped after this, and what is
     * measured here is only near what will be drawn.
     */
    doubt?: ArrayLike<number>;
}

/** The order a mesh's vertices can go in. */
export interface DetailOrder {
    /** What each vertex is folded into when it goes; itself if never. */
    parent: Uint32Array;
    /**
     * What its going costs, metres: it goes for any view that can afford
     * that much. Infinity for a vertex that never goes. A vertex never
     * costs less than one that went before it, so what a view keeps is
     * always a mesh that was reached on the way.
     */
    cost: Float32Array;
}

/**
 * How far a joint may bend, as the length of the chord it swings a point
 * a metre away through: two thirds of a turn either way.
 */
const BEND = 2 * Math.sin((120 * Math.PI) / 360);
/** A triangle may not be turned by more than this as vertices go. */
const TURN = Math.cos((75 * Math.PI) / 180);

/** The point of a triangle nearest a point: its weights at the corners. */
function nearest(
    p: ArrayLike<number>,
    at: number,
    position: Float32Array,
    a: number,
    b: number,
    c: number,
    out: Float64Array
) {
    const px = p[at];
    const py = p[at + 1];
    const pz = p[at + 2];
    const ax = position[a * 3];
    const ay = position[a * 3 + 1];
    const az = position[a * 3 + 2];
    const abx = position[b * 3] - ax;
    const aby = position[b * 3 + 1] - ay;
    const abz = position[b * 3 + 2] - az;
    const acx = position[c * 3] - ax;
    const acy = position[c * 3 + 1] - ay;
    const acz = position[c * 3 + 2] - az;
    const apx = px - ax;
    const apy = py - ay;
    const apz = pz - az;
    const d1 = abx * apx + aby * apy + abz * apz;
    const d2 = acx * apx + acy * apy + acz * apz;
    let u = 0;
    let v = 0;
    if (d1 <= 0 && d2 <= 0) {
        // Nearest the first corner.
    } else {
        const bpx = apx - abx;
        const bpy = apy - aby;
        const bpz = apz - abz;
        const d3 = abx * bpx + aby * bpy + abz * bpz;
        const d4 = acx * bpx + acy * bpy + acz * bpz;
        if (d3 >= 0 && d4 <= d3) {
            u = 1;
        } else {
            const vc = d1 * d4 - d3 * d2;
            if (vc <= 0 && d1 >= 0 && d3 <= 0) {
                u = d1 / (d1 - d3);
            } else {
                const cpx = apx - acx;
                const cpy = apy - acy;
                const cpz = apz - acz;
                const d5 = abx * cpx + aby * cpy + abz * cpz;
                const d6 = acx * cpx + acy * cpy + acz * cpz;
                if (d6 >= 0 && d5 <= d6) {
                    v = 1;
                } else {
                    const vb = d5 * d2 - d1 * d6;
                    if (vb <= 0 && d2 >= 0 && d6 <= 0) {
                        v = d2 / (d2 - d6);
                    } else {
                        const va = d3 * d6 - d5 * d4;
                        if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) {
                            v = (d4 - d3) / (d4 - d3 + (d5 - d6));
                            u = 1 - v;
                        } else {
                            const sum = va + vb + vc;
                            u = vb / sum;
                            v = vc / sum;
                        }
                    }
                }
            }
        }
    }
    const dx = apx - abx * u - acx * v;
    const dy = apy - aby * u - acy * v;
    const dz = apz - abz * u - acz * v;
    out[0] = 1 - u - v;
    out[1] = u;
    out[2] = v;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/** How far a point is from the stretch between two vertices. */
function offSegment(
    p: ArrayLike<number>,
    at: number,
    position: Float32Array,
    a: number,
    b: number
) {
    const ax = position[a * 3];
    const ay = position[a * 3 + 1];
    const az = position[a * 3 + 2];
    const bx = position[b * 3] - ax;
    const by = position[b * 3 + 1] - ay;
    const bz = position[b * 3 + 2] - az;
    const px = p[at] - ax;
    const py = p[at + 1] - ay;
    const pz = p[at + 2] - az;
    const along = Math.min(
        1,
        Math.max(
            0,
            (px * bx + py * by + pz * bz) / (bx * bx + by * by + bz * bz || 1)
        )
    );
    return Math.hypot(px - bx * along, py - by * along, pz - bz * along);
}

/** The cheapest first: a heap of things to try, by cost. */
class Queue {
    private cost: number[] = [];
    private item: number[][] = [];
    get size() {
        return this.cost.length;
    }
    push(cost: number, item: number[]) {
        const { cost: costs, item: items } = this;
        let at = costs.length;
        costs.push(cost);
        items.push(item);
        while (at > 0) {
            const up = (at - 1) >> 1;
            if (costs[up] <= cost) break;
            costs[at] = costs[up];
            items[at] = items[up];
            at = up;
        }
        costs[at] = cost;
        items[at] = item;
    }
    pop(): [number, number[]] {
        const { cost: costs, item: items } = this;
        const top: [number, number[]] = [costs[0], items[0]];
        const cost = costs.pop();
        const item = items.pop();
        const size = costs.length;
        if (size) {
            let at = 0;
            for (;;) {
                let down = at * 2 + 1;
                if (down >= size) break;
                if (down + 1 < size && costs[down + 1] < costs[down]) down++;
                if (costs[down] >= cost) break;
                costs[at] = costs[down];
                items[at] = items[down];
                at = down;
            }
            costs[at] = cost;
            items[at] = item;
        }
        return top;
    }
}

/**
 * Work out the order a mesh's vertices can go in, the cheapest first, and
 * what each costs. Edges that only one triangle uses (the rim of an
 * opening, the edge of a piece) are kept as edges: a vertex on one goes
 * only along it. `tally`, if given, is told how many costs were set by
 * the surface resting `apart`, by it `moving`, and by its `shade`.
 */
export function collapseOrder(
    input: DetailInput,
    tally?: Record<string, number>
): DetailOrder {
    const { position, normal, morphs = [], skin } = input;
    const fields = input.fields || [];
    const count = position.length / 3;
    const original = Uint32Array.from(input.indices);
    const triangles = original.length / 3;
    const corner = Int32Array.from(original);
    const alive = new Uint8Array(triangles).fill(1);
    const gone = new Uint8Array(count);
    const parent = new Uint32Array(count);
    const cost = new Float32Array(count).fill(Infinity);
    for (let v = 0; v < count; v++) parent[v] = v;

    // The triangles round each vertex.
    const round: number[][] = Array.from({ length: count }, () => []);
    for (let t = 0; t < triangles; t++)
        for (let k = 0; k < 3; k++) round[corner[t * 3 + k]].push(t);
    // Which way the surface faces at each vertex, as it is to begin
    // with: its triangles' own facing, the larger counting for more.
    const faced = new Float64Array(count * 3);
    for (let t = 0; t < triangles; t++) {
        const [a, b, c] = [0, 1, 2].map((k) => corner[t * 3 + k] * 3);
        const x1 = position[b] - position[a];
        const y1 = position[b + 1] - position[a + 1];
        const z1 = position[b + 2] - position[a + 2];
        const x2 = position[c] - position[a];
        const y2 = position[c + 1] - position[a + 1];
        const z2 = position[c + 2] - position[a + 2];
        for (const w of [a, b, c]) {
            faced[w] += y1 * z2 - z1 * y2;
            faced[w + 1] += z1 * x2 - x1 * z2;
            faced[w + 2] += x1 * y2 - y1 * x2;
        }
    }
    for (let v = 0; v < count; v++) {
        const length =
            Math.hypot(faced[v * 3], faced[v * 3 + 1], faced[v * 3 + 2]) || 1;
        for (let k = 0; k < 3; k++) faced[v * 3 + k] /= length;
    }

    // What the whole mesh is remembered by: every vertex, and the middle
    // of every triangle. Each lies on the mesh as it now is, on the
    // triangle it is `held` by; a vertex needs holding once it has gone.
    const samples = count + triangles;
    const held: number[][] = Array.from({ length: triangles }, (_, t) => [
        count + t,
    ]);
    const place = new Float64Array(samples * 3);
    for (let v = 0; v < count * 3; v++) place[v] = position[v];
    for (let t = 0; t < triangles; t++)
        for (let k = 0; k < 3; k++)
            place[(count + t) * 3 + k] =
                (position[original[t * 3] * 3 + k] +
                    position[original[t * 3 + 1] * 3 + k] +
                    position[original[t * 3 + 2] * 3 + k]) /
                3;
    /** What a sample is made of: vertices, and how much of each. */
    const made = (sample: number, into: number[]) => {
        if (sample < count) {
            into[0] = sample;
            into[1] = 1;
            into.length = 2;
            return;
        }
        const t = (sample - count) * 3;
        for (let k = 0; k < 3; k++) {
            into[k * 2] = original[t + k];
            into[k * 2 + 1] = 1 / 3;
        }
        into.length = 6;
    };

    // Which expressions move each vertex at all.
    const moved: number[][] = Array.from({ length: count }, () => []);
    morphs.forEach((morph, m) => {
        for (let v = 0; v < count; v++)
            if (morph[v * 3] || morph[v * 3 + 1] || morph[v * 3 + 2])
                moved[v].push(m);
    });
    const bones = skin ? skin.parent.length : 0;
    const pull = new Float64Array(bones);
    const pulled: number[] = [];

    // Edges only one triangle uses.
    const edgeUse = new Map<number, number>();
    const edgeKey = (a: number, b: number) =>
        a < b ? a * count + b : b * count + a;
    for (let t = 0; t < triangles; t++)
        for (let k = 0; k < 3; k++) {
            const key = edgeKey(
                corner[t * 3 + k],
                corner[t * 3 + ((k + 1) % 3)]
            );
            edgeUse.set(key, (edgeUse.get(key) || 0) + 1);
        }
    const onEdge = new Uint8Array(count);
    for (const [key, uses] of edgeUse)
        if (uses === 1) {
            onEdge[Math.floor(key / count)] = 1;
            onEdge[key % count] = 1;
        }
    const openEdge = (a: number, b: number) => edgeUse.get(edgeKey(a, b)) === 1;

    const neighbours = (v: number) => {
        const set = new Set<number>();
        for (const t of round[v])
            for (let k = 0; k < 3; k++)
                if (corner[t * 3 + k] !== v) set.add(corner[t * 3 + k]);
        return set;
    };

    // What set the cost of the last fold looked at: for the tally.
    let leading = "none";
    const mix: number[] = [];
    const weights = new Float64Array(3);
    const best = new Float64Array(3);
    /**
     * What it costs for `u` to go into `v`, or Infinity if it may not.
     * With `settle`, each sample is told which triangle now holds it.
     */
    const fold = (u: number, v: number, settle?: Map<number, number>) => {
        // The triangles that stay, with `v` where `u` was.
        const staying: number[] = [];
        let shared = 0;
        for (const t of round[u]) {
            const a = corner[t * 3];
            const b = corner[t * 3 + 1];
            const c = corner[t * 3 + 2];
            if (a === v || b === v || c === v) shared++;
            else staying.push(t);
        }
        // Along an open edge or not at all, for a vertex on one; and the
        // two must share exactly the neighbours their edge's triangles
        // give them, or the surface would pinch.
        const open = openEdge(u, v);
        if (onEdge[u] && !open) return Infinity;
        if (shared !== (open ? 1 : 2)) return Infinity;
        const mine = neighbours(u);
        let common = 0;
        for (const w of neighbours(v)) if (mine.has(w)) common++;
        if (common !== shared) return Infinity;
        if (!staying.length) return Infinity;

        // No triangle may turn over, or nearly.
        let reach = 0;
        for (const w of mine)
            reach = Math.max(
                reach,
                Math.hypot(
                    position[w * 3] - position[u * 3],
                    position[w * 3 + 1] - position[u * 3 + 1],
                    position[w * 3 + 2] - position[u * 3 + 2]
                )
            );
        for (const t of staying) {
            const at = [corner[t * 3], corner[t * 3 + 1], corner[t * 3 + 2]];
            const to = at.map((w) => (w === u ? v : w));
            const face = (p: number[]) => {
                const [a, b, c] = p.map((w) => w * 3);
                const x1 = position[b] - position[a];
                const y1 = position[b + 1] - position[a + 1];
                const z1 = position[b + 2] - position[a + 2];
                const x2 = position[c] - position[a];
                const y2 = position[c + 1] - position[a + 1];
                const z2 = position[c + 2] - position[a + 2];
                return [
                    y1 * z2 - z1 * y2,
                    z1 * x2 - x1 * z2,
                    x1 * y2 - y1 * x2,
                ];
            };
            const [was, now] = [face(at), face(to)];
            const sizes = Math.hypot(...was) * Math.hypot(...now);
            if (!(sizes > 0)) return Infinity;
            if (
                (was[0] * now[0] + was[1] * now[1] + was[2] * now[2]) / sizes <
                TURN
            )
                return Infinity;
            // Nor, by small turns one after another, come to face the
            // other way from the surface it was cut from.
            let agrees = 0;
            for (const w of to)
                agrees +=
                    now[0] * faced[w * 3] +
                    now[1] * faced[w * 3 + 1] +
                    now[2] * faced[w * 3 + 2];
            if (!(agrees > 0)) return Infinity;
        }

        // Where the outline will run round here: the edges only one
        // triangle uses, as they will be. One of a triangle that goes is
        // taken over by the triangle behind it.
        const outline: number[] = [];
        for (const t of round[u])
            for (let k = 0; k < 3; k++) {
                const a = corner[t * 3 + k];
                const b = corner[t * 3 + ((k + 1) % 3)];
                if (!openEdge(a, b)) continue;
                const [to, from] = [a === u ? v : a, b === u ? v : b];
                if (to !== from) outline.push(to, from);
            }

        let worst = 0;
        leading = "none";
        const judge = (sample: number) => {
            // The nearest of the triangles that stay.
            let nearestOne = -1;
            let distance = Infinity;
            for (const t of staying) {
                const d = nearest(
                    place,
                    sample * 3,
                    position,
                    corner[t * 3] === u ? v : corner[t * 3],
                    corner[t * 3 + 1] === u ? v : corner[t * 3 + 1],
                    corner[t * 3 + 2] === u ? v : corner[t * 3 + 2],
                    weights
                );
                if (d < distance) {
                    distance = d;
                    nearestOne = t;
                    best.set(weights);
                }
            }
            settle?.set(sample, nearestOne);
            const t = nearestOne * 3;
            const onto = [0, 1, 2].map((k) =>
                corner[t + k] === u ? v : corner[t + k]
            );
            made(sample, mix);
            // How far apart the two are drawn. What was on the outline
            // is as far off as the outline now runs from it, whichever
            // side of it the surface has come to lie.
            let apart = distance;
            if (sample < count && onEdge[sample] && outline.length) {
                let off = Infinity;
                for (let i = 0; i < outline.length; i += 2)
                    off = Math.min(
                        off,
                        offSegment(
                            place,
                            sample * 3,
                            position,
                            outline[i],
                            outline[i + 1]
                        )
                    );
                apart = Math.max(apart, off);
            }
            let shade = 0;
            for (const field of fields) {
                let sum = 0;
                for (let k = 0; k < field.width; k++) {
                    let d = 0;
                    for (let i = 0; i < mix.length; i += 2)
                        d += field.data[mix[i] * field.width + k] * mix[i + 1];
                    for (let i = 0; i < 3; i++)
                        d -= field.data[onto[i] * field.width + k] * best[i];
                    sum += d * d;
                }
                const off = Math.sqrt(sum);
                apart += off * (field.place || 0);
                shade += off * (field.shade || 0);
            }
            if (normal) {
                const facing = (
                    of: ArrayLike<number>,
                    by: ArrayLike<number> | null
                ) => {
                    const n = [0, 0, 0];
                    for (let i = 0; i < (by ? 3 : of.length / 2); i++) {
                        const w = by ? of[i] : of[i * 2];
                        const share = by ? by[i] : of[i * 2 + 1];
                        for (let k = 0; k < 3; k++)
                            n[k] += normal[w * 3 + k] * share;
                    }
                    const length = Math.hypot(n[0], n[1], n[2]) || 1;
                    return n.map((x) => x / length);
                };
                const [was, now] = [facing(mix, null), facing(onto, best)];
                shade +=
                    Math.hypot(
                        was[0] - now[0],
                        was[1] - now[1],
                        was[2] - now[2]
                    ) * (input.turned ?? 1);
            }
            // In an expression: the furthest any one takes them apart.
            let moving = 0;
            if (morphs.length) {
                const which = new Set<number>();
                for (let i = 0; i < mix.length; i += 2)
                    for (const m of moved[mix[i]]) which.add(m);
                for (const w of onto) for (const m of moved[w]) which.add(m);
                for (const m of which) {
                    const morph = morphs[m];
                    let sum = 0;
                    for (let k = 0; k < 3; k++) {
                        let d = 0;
                        for (let i = 0; i < mix.length; i += 2)
                            d += morph[mix[i] * 3 + k] * mix[i + 1];
                        for (let i = 0; i < 3; i++)
                            d -= morph[onto[i] * 3 + k] * best[i];
                        sum += d * d;
                    }
                    moving = Math.max(moving, Math.sqrt(sum));
                }
            }
            // When a joint bends: what follows it of one and not of the
            // other swings away, by how far it is from the joint.
            if (skin) {
                const add = (w: number, share: number) => {
                    for (let k = 0; k < 4; k++) {
                        const weight = skin.weights[w * 4 + k] * share;
                        if (!weight) continue;
                        for (
                            let bone = skin.joints[w * 4 + k];
                            bone >= 0;
                            bone = skin.parent[bone]
                        ) {
                            if (!pull[bone]) pulled.push(bone);
                            pull[bone] += weight;
                        }
                    }
                };
                for (let i = 0; i < mix.length; i += 2) add(mix[i], mix[i + 1]);
                for (let i = 0; i < 3; i++) add(onto[i], -best[i]);
                for (const bone of pulled) {
                    const swing =
                        Math.abs(pull[bone]) *
                        BEND *
                        Math.hypot(
                            place[sample * 3] - skin.pivot[bone * 3],
                            place[sample * 3 + 1] - skin.pivot[bone * 3 + 1],
                            place[sample * 3 + 2] - skin.pivot[bone * 3 + 2]
                        );
                    moving = Math.max(moving, swing);
                    pull[bone] = 0;
                }
                pulled.length = 0;
            }
            const most = Math.max(apart + moving, shade * reach);
            if (most > worst) {
                worst = most;
                leading =
                    shade * reach > apart + moving
                        ? "shade"
                        : moving > apart
                        ? "moving"
                        : "apart";
            }
        };
        judge(u);
        for (const t of round[u]) for (const sample of held[t]) judge(sample);
        return Math.max(
            worst * (input.doubt ? input.doubt[u] : 1),
            input.least ? input.least[u] : 0
        );
    };

    // Each vertex's cheapest way to go, and the queue of them. A vertex's
    // turn is void if anything round it has changed since it was queued.
    const stamp = new Uint32Array(count);
    const queue = new Queue();
    const offer = (u: number) => {
        stamp[u]++;
        if (gone[u] || input.locked?.[u]) return;
        let least = Infinity;
        let into = -1;
        for (const v of neighbours(u)) {
            const price = fold(u, v);
            if (price < least) {
                least = price;
                into = v;
            }
        }
        if (into >= 0) queue.push(least, [u, into, stamp[u]]);
    };
    for (let v = 0; v < count; v++) offer(v);

    let level = 0;
    while (queue.size) {
        const [, [u, v, stamped]] = queue.pop();
        if (gone[u] || gone[v] || stamp[u] !== stamped) continue;
        const settled = new Map<number, number>();
        const price = fold(u, v, settled);
        if (price === Infinity) continue;
        if (tally) tally[leading] = (tally[leading] || 0) + 1;
        // Never cheaper than what went before.
        level = Math.max(level, price);
        cost[u] = level;
        parent[u] = v;
        gone[u] = 1;
        const near = neighbours(u);
        // Edges of the triangles that go are used once less; those of
        // the triangles that stay change one end.
        for (const t of round[u]) {
            for (let k = 0; k < 3; k++) {
                const key = edgeKey(
                    corner[t * 3 + k],
                    corner[t * 3 + ((k + 1) % 3)]
                );
                const uses = edgeUse.get(key) - 1;
                if (uses) edgeUse.set(key, uses);
                else edgeUse.delete(key);
            }
        }
        const samplesHere: number[] = [u];
        for (const t of round[u]) {
            for (const sample of held[t]) samplesHere.push(sample);
            held[t] = [];
            const has =
                corner[t * 3] === v ||
                corner[t * 3 + 1] === v ||
                corner[t * 3 + 2] === v;
            if (has) {
                alive[t] = 0;
                for (let k = 0; k < 3; k++) {
                    const w = corner[t * 3 + k];
                    if (w !== u) round[w] = round[w].filter((x) => x !== t);
                }
                continue;
            }
            for (let k = 0; k < 3; k++)
                if (corner[t * 3 + k] === u) corner[t * 3 + k] = v;
            round[v].push(t);
        }
        for (const t of round[u]) {
            if (!alive[t]) continue;
            for (let k = 0; k < 3; k++) {
                const key = edgeKey(
                    corner[t * 3 + k],
                    corner[t * 3 + ((k + 1) % 3)]
                );
                edgeUse.set(key, (edgeUse.get(key) || 0) + 1);
            }
        }
        round[u] = [];
        for (const sample of samplesHere)
            held[settled.get(sample)].push(sample);
        for (const w of near) offer(w);
    }
    return { parent, cost };
}

/**
 * The triangles of a mesh for a view that can do without every vertex
 * `goes` says yes to: each such vertex is folded into what it goes into,
 * and triangles left with two corners alike are dropped. What `goes` must
 * hold to is that a vertex's `parent` goes only if the vertex does.
 */
export function coarser(
    indices: ArrayLike<number>,
    parent: ArrayLike<number>,
    goes: (vertex: number) => boolean
) {
    const into = new Int32Array(parent.length).fill(-1);
    const stands = (v: number) => {
        let at = v;
        while (into[at] < 0 && goes(at) && parent[at] !== at) at = parent[at];
        const found = into[at] < 0 ? at : into[at];
        // Remember it for everything on the way.
        for (let w = v; w !== at; w = parent[w]) into[w] = found;
        into[at] = found;
        return found;
    };
    const kept: number[] = [];
    for (let t = 0; t < indices.length; t += 3) {
        const a = stands(indices[t]);
        const b = stands(indices[t + 1]);
        const c = stands(indices[t + 2]);
        if (a !== b && b !== c && c !== a) kept.push(a, b, c);
    }
    return kept;
}
