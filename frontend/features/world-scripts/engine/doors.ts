/**
 * The world's own doors, as world scripts see and swing them. A door is a
 * group of the model named `Portal_Door_<n>`: the worlds built with doors
 * hang each on its hinge, so turning the group about the up axis opens it.
 *
 * A door the space has made a portal belongs to that portal: it is listed,
 * and a script cannot swing it.
 */
import { Box3, Matrix4, Vector3, type Mesh, type Object3D } from "three";
import Root from "@3/three/root";
import { CURRENT_SPACE } from "@3/three/constants";
import type { DoorInfo } from "../protocol";
import { worldModel } from "./openings";

const DOOR_NAME = /^Portal_Door_(\d+)$/i;
/** How far a door swings when fully open, as the worlds' own clips do. */
const FULL_SWING = (Math.PI * 3) / 4;
const MAX_DOORS = 200;

type Door = { info: DoorInfo; object: Object3D; shut: number };

/**
 * The way out through a door: the side its faces look to, told from back
 * to front by `rough` (from what stands behind the door to the door).
 */
export function doorFacing(door: Object3D, rough: Vector3) {
    const sum = new Vector3();
    const a = new Vector3();
    const b = new Vector3();
    const c = new Vector3();
    const normal = new Vector3();
    door.traverse((node) => {
        const mesh = node as Mesh;
        const position = mesh.geometry?.getAttribute("position");
        if (!mesh.isMesh || !position) return;
        const index = mesh.geometry.getIndex();
        const corners = index ? index.count : position.count;
        for (let i = 0; i + 2 < corners; i += 3) {
            a.fromBufferAttribute(position, index ? index.getX(i) : i);
            b.fromBufferAttribute(position, index ? index.getX(i + 1) : i + 1);
            c.fromBufferAttribute(position, index ? index.getX(i + 2) : i + 2);
            for (const point of [a, b, c]) point.applyMatrix4(mesh.matrixWorld);
            // twice the triangle's area, along its normal
            normal.copy(b).sub(a).cross(c.sub(a));
            const area = normal.length();
            if (area < 1e-9) continue;
            normal.divideScalar(area);
            // faces square to the way out count; the door's edges do not
            const along = normal.dot(rough);
            sum.addScaledVector(normal, area * along * Math.abs(along));
        }
    });
    sum.y = 0;
    return sum.lengthSq() > 1e-12
        ? sum.normalize()
        : rough.clone().setY(0).normalize();
}

/** Parts of the model big enough to be a building, with where they stand. */
function buildingParts(model: Object3D) {
    const parts: {
        toPart: Matrix4;
        place: Matrix4;
        box: Box3;
        area: number;
    }[] = [];
    const place = new Matrix4();
    const size = new Vector3();
    model.traverse((node) => {
        const mesh = node as any;
        if (!mesh.isMesh || !mesh.geometry || !mesh.visible) return;
        const geometry = mesh.geometry;
        if (!geometry.boundingBox) geometry.computeBoundingBox();
        const box: Box3 = geometry.boundingBox;
        const copies = mesh.isInstancedMesh ? mesh.count : 1;
        for (let copy = 0; copy < copies && parts.length < 4000; copy++) {
            if (mesh.isInstancedMesh) {
                mesh.getMatrixAt(copy, place);
                place.premultiply(mesh.matrixWorld);
            } else place.copy(mesh.matrixWorld);
            const scale = place.getMaxScaleOnAxis();
            box.getSize(size).multiplyScalar(scale);
            // a house, not a blade of grass or the whole landscape
            if (
                size.y < 3 ||
                Math.max(size.x, size.z) > 60 ||
                Math.min(size.x, size.z) < 3
            )
                continue;
            parts.push({
                toPart: place.clone().invert(),
                place: place.clone(),
                box,
                area: size.x * size.y + size.y * size.z + size.x * size.z,
            });
        }
    });
    return parts;
}

export function createDoors() {
    let model: Object3D | null = null;
    let doors = new Map<string, Door>();

    function assigned(): Set<string> {
        const portals = (CURRENT_SPACE as any)?.exhibit?.portals || {};
        return new Set(Object.values(portals).map((portal: any) => portal?.id));
    }

    function read() {
        const now = worldModel();
        if (now === model) return;
        model = now;
        doors = new Map();
        if (!model) return;
        model.updateMatrixWorld(true);
        const placeholders: any[] =
            (Root as any).currentSpace?.portalPlaceholders || [];
        const portals = assigned();
        const parts = buildingParts(model);
        const found: Object3D[] = [];
        model.traverse((node) => {
            if (DOOR_NAME.test(node.name) && found.length < MAX_DOORS)
                found.push(node);
        });
        const bounds = new Box3();
        const centre = new Vector3();
        const behind = new Vector3();
        const point = new Vector3();
        const toDoor = new Matrix4();
        for (const object of found) {
            bounds.setFromObject(object);
            if (bounds.isEmpty()) continue;
            bounds.getCenter(centre);
            const placeholder = placeholders.find(
                (item) => item?.meshes?.portalDoor === object
            );
            // what the portal would show stands just behind the door
            const preview =
                placeholder?.meshes?.originalPreviewMesh ||
                placeholder?.meshes?.previewMesh;
            if (!preview) continue;
            if (preview.parent) preview.getWorldPosition(behind);
            else behind.copy(preview.position);
            const rough = centre.clone().sub(behind).setY(0);
            if (rough.lengthSq() < 1e-8) continue;
            const out = doorFacing(object, rough.normalize());
            const yaw = Math.atan2(out.x, out.z);

            // the door measured square to itself
            toDoor.makeRotationY(yaw).setPosition(centre).invert();
            const local = new Box3();
            object.traverse((node) => {
                const mesh = node as Mesh;
                const position = mesh.geometry?.getAttribute("position");
                if (!mesh.isMesh || !position) return;
                for (let i = 0; i < position.count; i++)
                    local.expandByPoint(
                        point
                            .fromBufferAttribute(position, i)
                            .applyMatrix4(mesh.matrixWorld)
                            .applyMatrix4(toDoor)
                    );
            });
            if (local.isEmpty()) continue;
            const middle = new Vector3(
                (local.min.x + local.max.x) / 2,
                local.min.y,
                (local.min.z + local.max.z) / 2
            ).applyMatrix4(toDoor.clone().invert());

            // the building: the largest part of the model standing behind it
            point.copy(centre).addScaledVector(out, -1.5);
            let building: DoorInfo["building"] = null;
            let most = 0;
            for (const part of parts) {
                behind.copy(point).applyMatrix4(part.toPart);
                if (!part.box.containsPoint(behind) || part.area <= most)
                    continue;
                most = part.area;
                const scale = part.place.getMaxScaleOnAxis();
                const size = part.box
                    .getSize(new Vector3())
                    .multiplyScalar(scale);
                const at = part.box.getCenter(new Vector3());
                at.y = part.box.min.y;
                at.applyMatrix4(part.place);
                building = {
                    position: [at.x, at.y, at.z],
                    size: [size.x, size.y, size.z],
                };
            }

            const id = object.name;
            doors.set(id, {
                object,
                shut: object.rotation.y,
                info: {
                    id,
                    position: [middle.x, middle.y, middle.z],
                    yaw,
                    width: local.max.x - local.min.x,
                    height: local.max.y - local.min.y,
                    portal: portals.has(placeholder.portalId),
                    open: 0,
                    building,
                },
            });
        }
    }

    return {
        list(): DoorInfo[] {
            read();
            return [...doors.values()].map((door) => door.info);
        },
        set(id: string, open: number) {
            read();
            const door = doors.get(id);
            if (!door || door.info.portal) return;
            door.info.open = open;
            door.object.rotation.y = door.shut + FULL_SWING * open;
        },
        reset() {
            if (model !== worldModel()) return;
            doors.forEach((door) => {
                door.info.open = 0;
                door.object.rotation.y = door.shut;
            });
        },
    };
}
