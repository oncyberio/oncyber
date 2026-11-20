import * as T from "three/webgpu";
import { streetSkinTile } from "./streetBrush";
import * as N from "three/tsl";
import type { LobbyAvatar } from "../lobby/webgpu/avatarAdapter";
import type { PupilSpan } from "./gazePose";
import {
    portraitDirection,
    creaseUVBase,
    frontalCreaseUVBase,
    streetFaceUVBase,
    insetPupilUVBase,
    surfaceGrain,
    illustratedMask,
} from "./surfaces";

const BONES = 64,
    WIDTH = BONES * 4;
type Entry = {
    avatar: LobbyAvatar;
    mesh: T.SkinnedMesh;
    visible: boolean;
    start: number;
    index: T.BufferAttribute;
    count: number;
    reveal: number;
    gazeVersion: number;
};

/** Unlike instancing by URL, all the silhouettes share one index buffer. The
 * vertex selects its owner's palette row and retains its own paint and UVs.
 * Only bone palettes change during ordinary motion. Joining and leaving rebuild
 * the static vertex buffers, visibility changes compact only the index buffer. */
export class RecipeCrowdBatch {
    private entries = new Set<Entry>();
    private mesh: T.Mesh;
    private dirty = true;
    private disposed = false;
    private palette: T.DataTexture;
    private binding: ReturnType<typeof N.texture>;
    private material: T.MeshBasicNodeMaterial;
    private frustum = new T.Frustum();
    private projection = new T.Matrix4();
    private sphere = new T.Sphere();
    private matrix = new T.Matrix4();
    private batchInverse = new T.Matrix4();
    private texMatrix = new T.Matrix4();
    private scale = new T.Vector3();
    visible = 0;
    geometryBytes = 0;
    constructor(
        private scene: T.Scene,
        private coordinateSystem: T.CoordinateSystem = T.WebGPUCoordinateSystem
    ) {
        this.palette = this.makePalette(1);
        this.binding = N.texture(this.palette);
        const cornea = N.vec3(0, 0, 1).toVar("crowdCornea");
        const material = new T.MeshBasicNodeMaterial({
            side: T.DoubleSide,
            vertexColors: true,
            maskNode: illustratedMask(),
            colorNode: surfaceGrain(
                () => N.transformNormalToView(cornea),
                true
            ),
        });
        const rig = N.attribute("recipeRig", "vec3");
        const row = N.uint(rig.x).div(N.uint(BONES));
        const read = (column, row) => this.binding.load(N.uvec2(column, row));
        const matrix = (key) => {
            const index = N.uint(key),
                x = index.mod(N.uint(BONES)).mul(N.uint(4));
            const y = index.div(N.uint(BONES));
            return (N.mat4 as Function)(
                read(x, y),
                read(x.add(1), y),
                read(x.add(2), y),
                read(x.add(3), y)
            );
        };
        const paletteMatrix = (N.Fn as Function)(() => {
            const m = matrix(rig.x).toVar();
            N.If(rig.z.greaterThan(0), () => {
                m.assign(
                    m.mul(N.float(1).sub(rig.z)).add(matrix(rig.y).mul(rig.z))
                );
            });
            return m;
        });
        const skin = (N.Fn as Function)(() => {
            const m = paletteMatrix();
            const tile = N.floor(N.uv().x);
            N.If(
                N.uv()
                    .x.greaterThanEqual(insetPupilUVBase)
                    .or(tile.equal(creaseUVBase))
                    .or(tile.equal(frontalCreaseUVBase))
                    .or(tile.equal(streetFaceUVBase))
                    .or(tile.equal(streetSkinTile)),
                () => {
                    cornea.assign(m.mul(N.vec4(portraitDirection(), 0)).xyz);
                }
            );
            N.positionLocal.assign(m.mul(N.vec4(N.positionLocal, 1)).xyz);
            N.normalLocal.assign(
                m.mul(N.vec4(N.normalLocal, 0)).xyz.normalize()
            );
        }, "void");
        const setup = material.setupPosition;
        material.setupPosition = function (builder) {
            skin();
            return setup.call(this, builder);
        };
        const reveal = N.varying(read(N.uint(WIDTH - 1), row).xy);
        const cell = N.abs(N.positionView.negate().mod(0.016).sub(0.008)).div(
            0.008
        );
        const revealOpacity = N.float(1).sub(
            N.step(
                reveal.x.sub(
                    reveal.y.mul(N.max(N.max(cell.x, cell.y), cell.z))
                ),
                N.positionWorld.y
            )
        );
        // Three renders the light's depth pass with an override material.
        // Its vertices must read the same actor and bone palette as the color pass.
        Object.assign(material, {
            opacityNode: revealOpacity,
            castShadowPositionNode: paletteMatrix().mul(
                N.vec4(N.positionLocal, 1)
            ).xyz,
            maskShadowNode: revealOpacity.greaterThan(0.001),
        });
        material.alphaTest = 0.001;
        this.material = material;
        this.mesh = new T.Mesh(new T.BufferGeometry(), material);
        this.mesh.name = "Procedural avatar crowd";
        this.mesh.frustumCulled = false;
        this.mesh.castShadow = true;
        this.mesh.visible = false;
        scene.add(this.mesh);
    }
    private makePalette(height: number) {
        const map = new T.DataTexture(
            new Float32Array(WIDTH * height * 4),
            WIDTH,
            height,
            T.RGBAFormat,
            T.FloatType
        );
        map.magFilter = map.minFilter = T.NearestFilter;
        map.generateMipmaps = false;
        map.needsUpdate = true;
        return map;
    }
    get size() {
        return this.entries.size;
    }
    get paletteBytes() {
        return this.palette.image.data.byteLength;
    }
    get triangles() {
        return this.mesh.visible ? this.mesh.geometry.drawRange.count / 3 : 0;
    }

    /** Keep the source mixer and normal avatar controls. Hide its individual draw. */
    add(avatar: LobbyAvatar) {
        const mesh = avatar.root.getObjectByProperty(
            "isSkinnedMesh",
            true
        ) as T.SkinnedMesh;
        if (
            this.disposed ||
            !mesh ||
            mesh.skeleton.bones.length >= BONES ||
            !mesh.geometry.index
        )
            throw Error("Unsupported procedural rig");
        const entry: Entry = {
            avatar,
            mesh,
            start: 0,
            visible: false,
            index: mesh.geometry.index,
            count: mesh.geometry.index.count,
            reveal: 1,
            gazeVersion: -1,
        };
        this.entries.add(entry);
        mesh.visible = false;
        this.dirty = true;
        avatar.setReveal = (amount) => {
            entry.reveal = T.MathUtils.clamp(amount, 0, 1);
        };
        const dispose = avatar.dispose;
        avatar.dispose = () => {
            if (!this.entries.delete(entry)) return;
            this.dirty = true;
            dispose();
        };
        return avatar;
    }
    private rebuild() {
        const entries = [...this.entries];
        let vertices = 0,
            count = 0;
        for (const e of entries) {
            e.start = vertices;
            vertices += e.mesh.geometry.attributes.position.count;
            count += e.index.count;
        }
        const out = new T.BufferGeometry();
        // RGBA8 is a native, four-byte-aligned normalized WebGPU vertex format.
        const color = new Uint8Array(vertices * 4),
            uv = new Float32Array(vertices * 2);
        const position = new Float32Array(vertices * 3),
            normal = new Float32Array(vertices * 3),
            rig = new Float32Array(vertices * 3);
        entries.forEach((entry, slot) => {
            const { mesh, start } = entry;
            entry.gazeVersion = (
                mesh.geometry.attributes.normal as T.BufferAttribute
            ).version;
            const a = mesh.geometry.attributes;
            position.set(a.position.array, 3 * start);
            normal.set(a.normal.array, 3 * start);
            uv.set(a.uv.array, 2 * start);
            for (let i = 0; i < a.position.count; i++) {
                const o = start + i;
                color[4 * o] = Math.min(255, Math.round(a.color.getX(i) * 255));
                color[4 * o + 1] = Math.min(
                    255,
                    Math.round(a.color.getY(i) * 255)
                );
                color[4 * o + 2] = Math.min(
                    255,
                    Math.round(a.color.getZ(i) * 255)
                );
                color[4 * o + 3] =
                    a.color.itemSize === 4
                        ? Math.round(a.color.getW(i) * 255)
                        : 255;
                rig[3 * o] = slot * BONES + a.skinIndex.getX(i);
                rig[3 * o + 1] = slot * BONES + a.skinIndex.getY(i);
                rig[3 * o + 2] = a.skinWeight.getY(i);
            }
        });
        out.setAttribute("position", new T.BufferAttribute(position, 3));
        out.setAttribute("normal", new T.BufferAttribute(normal, 3));
        out.setAttribute("uv", new T.BufferAttribute(uv, 2));
        out.setAttribute("color", new T.BufferAttribute(color, 4, true));
        out.setAttribute("recipeRig", new T.BufferAttribute(rig, 3));
        out.setIndex(
            new T.BufferAttribute(new Uint32Array(count), 1).setUsage(
                T.DynamicDrawUsage
            )
        );
        this.geometryBytes =
            position.byteLength +
            normal.byteLength +
            uv.byteLength +
            color.byteLength +
            rig.byteLength +
            count * 4;
        this.mesh.geometry.dispose();
        this.mesh.geometry = out;
        const height = T.MathUtils.ceilPowerOfTwo(Math.max(1, entries.length));
        if (this.palette.image.height !== height) {
            const old = this.palette;
            this.palette = this.makePalette(height);
            this.binding.value = this.palette;
            old.dispose();
        }
        this.dirty = false;
    }
    flush(camera: T.Camera) {
        if (this.disposed) return;
        let recull = this.dirty;
        if (this.dirty) this.rebuild();
        const data = this.palette.image.data as Float32Array;
        this.projection.multiplyMatrices(
            camera.projectionMatrix,
            camera.matrixWorldInverse
        );
        this.frustum.setFromProjectionMatrix(
            this.projection,
            this.coordinateSystem,
            camera.reversedDepth ?? false
        );
        this.mesh.updateWorldMatrix(true, false);
        this.batchInverse.copy(this.mesh.matrixWorld).invert();
        let slot = 0;
        this.visible = 0;
        for (const e of this.entries) {
            const { avatar, mesh } = e;
            avatar.root.updateWorldMatrix(true, false);
            this.scale.setFromMatrixScale(avatar.root.matrixWorld);
            this.sphere.center
                .set(0, 0.85, 0)
                .applyMatrix4(avatar.root.matrixWorld);
            this.sphere.radius =
                Math.max(this.scale.x, this.scale.y, this.scale.z) *
                Math.max(1.8, avatar.height);
            let show = !!(
                e.reveal > 0 && this.frustum.intersectsSphere(this.sphere)
            );
            for (
                let node: T.Object3D = avatar.root;
                show && node;
                node = node.parent
            )
                show = node.visible;
            const count = Math.min(
                e.index.count,
                mesh.geometry.drawRange.count
            );
            if (count !== e.count) {
                e.count = count;
                recull = true;
            }
            if (show !== e.visible) {
                e.visible = show;
                recull = true;
            }
            if (show) {
                this.visible++;
                const normal = mesh.geometry.attributes
                    .normal as T.BufferAttribute;
                if (normal.version !== e.gazeVersion) {
                    const spans: PupilSpan[] =
                        mesh.geometry.userData.pupilSpans ?? [];
                    for (const name of ["normal", "uv"]) {
                        const source = mesh.geometry.attributes[
                            name
                        ] as T.BufferAttribute;
                        const out = this.mesh.geometry.attributes[
                            name
                        ] as T.BufferAttribute;
                        for (const { start, count } of spans) {
                            const size = source.itemSize,
                                at = (e.start + start) * size;
                            out.array.set(
                                source.array.subarray(
                                    start * size,
                                    (start + count) * size
                                ),
                                at
                            );
                            out.addUpdateRange(at, count * size);
                        }
                        if (spans.length) out.needsUpdate = true;
                    }
                    e.gazeVersion = normal.version;
                }
                avatar.root.updateMatrixWorld(true);
                mesh.skeleton.update();
                this.matrix
                    .copy(this.batchInverse)
                    .multiply(mesh.matrixWorld)
                    .multiply(mesh.bindMatrixInverse);
                for (let b = 0; b < mesh.skeleton.bones.length; b++) {
                    this.texMatrix
                        .fromArray(mesh.skeleton.boneMatrices, b * 16)
                        .premultiply(this.matrix)
                        .multiply(mesh.bindMatrix);
                    this.texMatrix.toArray(data, (slot * BONES + b) * 16);
                }
                const o = (slot * WIDTH + WIDTH - 1) * 4,
                    h = avatar.height,
                    band = h * 0.22;
                data[o] =
                    e.reveal >= 0.9999
                        ? 1e5
                        : avatar.root.matrixWorld.elements[13] +
                          e.reveal * (h + 2 * band) -
                          band;
                data[o + 1] = e.reveal >= 0.9999 ? 0 : band;
            }
            slot++;
        }
        if (recull) {
            const index = this.mesh.geometry.index;
            let cursor = 0;
            for (const e of this.entries)
                if (e.visible) {
                    for (let i = 0; i < e.count; i++)
                        index.array[cursor++] = e.index.getX(i) + e.start;
                }
            index.clearUpdateRanges();
            if (cursor) index.addUpdateRange(0, cursor);
            index.needsUpdate = true;
            this.mesh.geometry.setDrawRange(0, cursor);
        }
        this.mesh.visible = this.visible > 0;
        if (this.visible) this.palette.needsUpdate = true;
    }
    dispose() {
        if (this.disposed) return;
        this.disposed = true;
        for (const e of [...this.entries]) e.avatar.dispose();
        this.mesh.removeFromParent();
        this.mesh.geometry.dispose();
        this.material.dispose();
        this.palette.dispose();
    }
}
