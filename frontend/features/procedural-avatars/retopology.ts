import * as T from "three/webgpu";

type Candidate = {
    from: number;
    to: number;
    cost: number;
    revisionA: number;
    revisionB: number;
};
class MinHeap {
    private heap: Candidate[] = [];
    push(item: Candidate) {
        let i = this.heap.length;
        this.heap.push(item);
        while (i) {
            const p = (i - 1) >> 1;
            if (this.heap[p].cost <= item.cost) break;
            this.heap[i] = this.heap[p];
            i = p;
        }
        this.heap[i] = item;
    }
    pop() {
        const first = this.heap[0],
            last = this.heap.pop();
        if (!last || !this.heap.length) return first;
        let i = 0;
        while (2 * i + 1 < this.heap.length) {
            let c = 2 * i + 1;
            if (
                c + 1 < this.heap.length &&
                this.heap[c + 1].cost < this.heap[c].cost
            )
                c++;
            if (this.heap[c].cost >= last.cost) break;
            this.heap[i] = this.heap[c];
            i = c;
        }
        this.heap[i] = last;
        return first;
    }
}

/** Collapse connected edges onto existing vertices. Plane error preserves volume,
 * boundary planes preserve ink and hems, and joints keep their control rings.
 * Choosing endpoints leaves all retained paint, skin weights and UVs exact. */
export function retopologize(
    g: T.BufferGeometry,
    fraction: number,
    tolerance: number,
    featureErrors: number[],
    silhouetteWeight = 16,
    budget?: { triangles: number; bodyJoints: ReadonlySet<number> },
    absorbIntoSeams = false
) {
    const p = g.attributes.position,
        n = p.count,
        col = g.attributes.color,
        uv = g.attributes.uv;
    const joints = g.attributes.skinIndex,
        weights = g.attributes.skinWeight;
    const faces = Int32Array.from(g.index.array),
        total = faces.length / 3;
    const goal = Math.floor(total * fraction);
    const plane = new Float64Array(n * 10),
        around = Array.from({ length: n }, () => new Set<number>());
    const revision = new Uint32Array(n),
        edgeCount = new Map<number, number>();
    const edge = (a: number, b: number) => Math.min(a, b) * n + Math.max(a, b);
    const facing = new Map<number, number>();
    const faceNormals = new Float64Array(total * 3),
        boundary = new Uint8Array(n);
    const A = new T.Vector3(),
        B = new T.Vector3(),
        C = new T.Vector3(),
        normal = new T.Vector3();
    function addPlane(
        i: number,
        x: number,
        y: number,
        z: number,
        w: number,
        k: number
    ) {
        let o = i * 10;
        plane[o++] += x * x * k;
        plane[o++] += x * y * k;
        plane[o++] += x * z * k;
        plane[o++] += x * w * k;
        plane[o++] += y * y * k;
        plane[o++] += y * z * k;
        plane[o++] += y * w * k;
        plane[o++] += z * z * k;
        plane[o++] += z * w * k;
        plane[o] += w * w * k;
    }
    for (let f = 0; f < total; f++) {
        const o = f * 3,
            a = faces[o],
            b = faces[o + 1],
            c = faces[o + 2];
        A.fromBufferAttribute(p, a);
        B.fromBufferAttribute(p, b);
        C.fromBufferAttribute(p, c);
        normal.crossVectors(B.sub(A), C.sub(A)).normalize();
        normal.toArray(faceNormals, o);
        const w = -A.dot(normal);
        for (let j = 0; j < 3; j++) {
            const v = faces[o + j],
                key = edge(v, faces[o + ((j + 1) % 3)]);
            around[v].add(f);
            edgeCount.set(key, (edgeCount.get(key) ?? 0) + 1);
            const signs = (normal.x > 0 ? 1 : 2) | (normal.z > 0 ? 4 : 8);
            facing.set(key, (facing.get(key) ?? 0) | signs);
            addPlane(v, normal.x, normal.y, normal.z, w, 1);
        }
    }
    for (let f = 0; f < total; f++)
        for (let j = 0; j < 3; j++) {
            const a = faces[3 * f + j],
                b = faces[3 * f + ((j + 1) % 3)];
            if (edgeCount.get(edge(a, b)) !== 1) continue;
            boundary[a] = boundary[b] = 1;
            A.fromBufferAttribute(p, a);
            B.fromBufferAttribute(p, b);
            normal
                .fromArray(faceNormals, 3 * f)
                .cross(B.sub(A))
                .normalize();
            const w = -normal.dot(A);
            addPlane(a, normal.x, normal.y, normal.z, w, 8);
            addPlane(b, normal.x, normal.y, normal.z, w, 8);
        }
    // A flat fabric panel can lose many interior edges. Its front and side
    // contours carry a much stricter projected error in the same objective.
    for (const [key, sign] of facing) {
        const a = Math.floor(key / n),
            b = key % n;
        A.fromBufferAttribute(p, a);
        B.fromBufferAttribute(p, b).sub(A);
        const constrain = (x: number, y: number, z: number) => {
            normal.set(x, y, z).normalize();
            const w = -normal.dot(A);
            addPlane(a, normal.x, normal.y, normal.z, w, silhouetteWeight);
            addPlane(b, normal.x, normal.y, normal.z, w, silhouetteWeight);
        };
        if ((sign & 3) === 3) constrain(0, B.z, -B.y);
        if ((sign & 12) === 12) constrain(B.y, -B.x, 0);
    }
    const heap = new MinHeap(),
        threshold = tolerance * tolerance;
    let bodyOnly: Uint8Array;
    function offer(a: number, b: number) {
        if (a === b || !around[a].size || !around[b].size) return;
        if (bodyOnly && (!bodyOnly[a] || !bodyOnly[b])) return;
        if (
            joints.getX(a) !== joints.getX(b) ||
            joints.getY(a) !== joints.getY(b) ||
            Math.abs(weights.getY(a) - weights.getY(b)) > 0.32 ||
            Math.min(64, Math.floor(uv.getX(a))) !==
                Math.min(64, Math.floor(uv.getX(b)))
        )
            return;
        A.fromBufferAttribute(p, a);
        B.fromBufferAttribute(p, b);
        const distance = A.distanceToSquared(B);
        const colorDelta =
            (col.getX(a) - col.getX(b)) ** 2 +
            (col.getY(a) - col.getY(b)) ** 2 +
            (col.getZ(a) - col.getZ(b)) ** 2;
        const extra = distance * (0.002 + colorDelta * 0.13);
        const evalAt = (v: number, at: T.Vector3) => {
            const o = v * 10,
                x = at.x,
                y = at.y,
                z = at.z;
            return (
                plane[o] * x * x +
                plane[o + 4] * y * y +
                plane[o + 7] * z * z +
                plane[o + 9] +
                2 *
                    (plane[o + 1] * x * y +
                        plane[o + 2] * x * z +
                        plane[o + 3] * x +
                        plane[o + 5] * y * z +
                        plane[o + 6] * y +
                        plane[o + 8] * z)
            );
        };
        // The surviving vertex's accumulated error matters after successive collapses.
        // A fitted surface can absorb a nearby interior vertex into a fixed
        // seam vertex. Forbidding both directions freezes an entire ring of
        // unnecessary neighbours. The fixed vertex and its attributes survive.
        const fixedA = absorbIntoSeams && featureErrors[a] === 0;
        const fixedB = absorbIntoSeams && featureErrors[b] === 0;
        if (fixedA && fixedB) return;
        const ca =
            fixedA || (boundary[a] && !boundary[b])
                ? Infinity
                : evalAt(a, B) + evalAt(b, B);
        const cb =
            fixedB || (boundary[b] && !boundary[a])
                ? Infinity
                : evalAt(a, A) + evalAt(b, A);
        if (cb < ca) [a, b] = [b, a];
        const cost = Math.max(0, Math.min(ca, cb)) + extra;
        // If the normal fit exceeded an explicit budget, trade a bounded
        // amount of body detail for it. Stitched contours, the head and hands
        // retain their original tolerances and cannot spend this allowance.
        const error =
            fixedA || fixedB
                ? featureErrors[a]
                : Math.min(featureErrors[a], featureErrors[b]);
        const limit = error * (bodyOnly ? 4 : 1);
        if (cost <= Math.min(threshold, limit))
            heap.push({
                from: a,
                to: b,
                cost,
                revisionA: revision[a],
                revisionB: revision[b],
            });
    }
    for (const key of edgeCount.keys()) offer(Math.floor(key / n), key % n);
    let count = total;
    const target = Math.min(goal, budget?.triangles ?? goal);
    while (count > (bodyOnly ? budget.triangles : target)) {
        const e = heap.pop();
        if (!e) {
            if (!budget || bodyOnly || count <= budget.triangles) break;
            const body = Uint8Array.from({ length: n }, (_, i) =>
                Number(
                    budget.bodyJoints.has(joints.getX(i)) &&
                        budget.bodyJoints.has(joints.getY(i))
                )
            );
            bodyOnly = body.slice();
            const live = new Set<number>();
            for (let i = 0; i < faces.length; i += 3) {
                if (faces[i] < 0) continue;
                if (
                    !(
                        body[faces[i]] &&
                        body[faces[i + 1]] &&
                        body[faces[i + 2]]
                    )
                ) {
                    for (let j = 0; j < 3; j++) bodyOnly[faces[i + j]] = 0;
                    continue;
                }
                for (let j = 0; j < 3; j++)
                    live.add(edge(faces[i + j], faces[i + ((j + 1) % 3)]));
            }
            for (const key of live) offer(Math.floor(key / n), key % n);
            continue;
        }
        const { from, to } = e;
        if (revision[from] !== e.revisionA || revision[to] !== e.revisionB)
            continue;
        const shared: number[] = [],
            neighbors = new Set<number>(),
            targetNeighbors = new Set<number>();
        let legal = true;
        for (const f of around[to])
            for (let j = 0; j < 3; j++) targetNeighbors.add(faces[3 * f + j]);
        for (const f of around[from]) {
            const o = f * 3;
            let adjacent = false;
            for (let k = 0; k < 3; k++) {
                const v = faces[o + k];
                neighbors.add(v);
                if (v === to) adjacent = true;
            }
            if (adjacent) {
                shared.push(f);
                continue;
            }
            const moved = (k: number) =>
                faces[o + k] === from ? to : faces[o + k];
            A.fromBufferAttribute(p, moved(0));
            B.fromBufferAttribute(p, moved(1));
            C.fromBufferAttribute(p, moved(2));
            normal.crossVectors(B.sub(A), C.sub(A)).normalize();
            if (normal.dot(A.fromArray(faceNormals, o)) < 0.42) {
                legal = false;
                break;
            }
        }
        neighbors.delete(from);
        neighbors.delete(to);
        targetNeighbors.delete(from);
        targetNeighbors.delete(to);
        if (
            !legal ||
            !shared.length ||
            shared.length > 2 ||
            (boundary[from] && boundary[to] && shared.length !== 1)
        )
            continue;
        if (around[from].size + around[to].size <= 2 * shared.length) continue;
        let common = 0;
        for (const v of neighbors) if (targetNeighbors.has(v)) common++;
        if (common !== shared.length) continue;
        for (const f of shared) {
            for (let k = 0; k < 3; k++) around[faces[3 * f + k]].delete(f);
            faces[3 * f] = -1;
        }
        count -= shared.length;
        for (const f of around[from]) {
            for (let j = 0; j < 3; j++)
                if (faces[3 * f + j] === from) faces[3 * f + j] = to;
            around[to].add(f);
        }
        around[from].clear();
        revision[from]++;
        revision[to]++;
        for (let i = 0; i < 10; i++) plane[to * 10 + i] += plane[from * 10 + i];
        for (const v of targetNeighbors) neighbors.add(v);
        for (const v of neighbors) offer(to, v);
    }
    const kept: number[] = [];
    const index: number[] = [];
    for (let f = 0; f < total; f++)
        if (faces[3 * f] >= 0)
            index.push(faces[3 * f], faces[3 * f + 1], faces[3 * f + 2]);
    const used = new Uint8Array(n),
        remap = new Uint32Array(n);
    for (const i of index) used[i] = 1;
    for (let i = 0; i < n; i++)
        if (used[i]) {
            remap[i] = kept.length;
            kept.push(i);
        }
    for (const [name, attr] of Object.entries(g.attributes)) {
        const a = attr as T.BufferAttribute,
            compact = new (a.array.constructor as typeof Float32Array)(
                kept.length * a.itemSize
            );
        for (let i = 0; i < kept.length; i++)
            for (let j = 0; j < a.itemSize; j++)
                compact[i * a.itemSize + j] = a.array[kept[i] * a.itemSize + j];
        g.setAttribute(
            name,
            new T.BufferAttribute(compact, a.itemSize, a.normalized)
        );
    }
    g.setIndex(index.map((i) => remap[i]));
    return kept;
}
