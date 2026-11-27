/**
 * The objects a world script has in the scene: made, changed, hung from
 * one another and taken away as the host says (../host.ts), in the
 * scripts' own group of the real scene.
 *
 * A property's rule (../protocol.ts, THING_PROPS) says what a change of it
 * means here: the thing is placed elsewhere, built again, or drawn again.
 */
import {
    DoubleSide,
    Group,
    Mesh,
    MeshBasicMaterial,
    PlaneGeometry,
    Sprite,
    SpriteMaterial,
    type BufferGeometry,
    type CanvasTexture,
    type Material,
    type Object3D,
} from "three";
import {
    BUILT_FROM_KEYS,
    LOOK_KEYS,
    SPECIAL_KEYS,
    type ThingProps,
} from "../protocol";
import { shapeBoxPositions, type createSolids } from "./collision";
import { geometryFor } from "./geometry";
import { applyTransform, places, type createGlides } from "./glides";
import { SPECIAL_SHAPES, type Special } from "./specials";

export interface Thing {
    object: Object3D;
    props: ThingProps;
    material: Material;
    texture?: CanvasTexture;
    geometry?: BufferGeometry;
    /** Shared look material in use (not owned by the thing). */
    lookKey?: string;
    outline?: Mesh;
    /** A model, solid, opening or avatar: what keeps it up to date. */
    special?: Special;
    /** A plain shape with a collider of its own. */
    solid?: boolean;
}

/** Shapes a script can make solid by saying so. */
const SOLID_SHAPES = ["box", "cylinder", "sphere", "cone", "capsule", "plane"];

const changed = (keys: readonly (keyof ThingProps)[], props: ThingProps) =>
    keys.some((key) => props[key] !== undefined);

function isInside(node: Object3D, ancestor: Object3D) {
    for (let n: Object3D | null = node; n; n = n.parent)
        if (n === ancestor) return true;
    return false;
}

export function createThings(world: {
    /** Where the scripts' things hang in the scene. */
    group: Group;
    solids: ReturnType<typeof createSolids>;
    glides: ReturnType<typeof createGlides>;
    /** Draws a thing as its properties say (./thingLooks.ts). */
    draw(thing: Thing): void;
    /** Gives back the shared look a thing was drawn with. */
    releaseLook(key: string): void;
    special(id: string, holder: Object3D, shape: string): Special;
}) {
    const { group, solids, glides } = world;
    const things = new Map<string, Thing>();
    const objectToThing = new Map<Object3D, string>();

    function build(id: string, props: ThingProps): Thing {
        let object: Object3D;
        let material: Material;
        let geometry: BufferGeometry;
        if (SPECIAL_SHAPES.includes(props.shape)) {
            object = new Group();
            object.name = `world-script:${id}`;
            return {
                object,
                props: { ...props },
                material: undefined,
                special: world.special(id, object, props.shape),
            };
        }
        if (props.shape === "text") {
            if (props.billboard === false) {
                material = new MeshBasicMaterial({
                    transparent: true,
                    side: DoubleSide,
                });
                geometry = new PlaneGeometry(1, 1);
                object = new Mesh(geometry, material);
            } else {
                material = new SpriteMaterial({
                    transparent: true,
                    depthWrite: false,
                });
                object = new Sprite(material as SpriteMaterial);
            }
        } else {
            geometry = geometryFor(props);
            // The look's shared material arrives when it is drawn.
            object = new Mesh(geometry);
            material = (object as Mesh).material as Material;
        }
        object.name = `world-script:${id}`;
        return { object, props: { ...props }, material, geometry };
    }

    function dispose(thing: Thing, id?: string) {
        thing.special?.dispose();
        thing.special = undefined;
        if (thing.solid && id) solids.set(id, thing.object, null);
        thing.solid = false;
        thing.object.removeFromParent();
        thing.outline?.removeFromParent();
        thing.geometry?.dispose();
        thing.texture?.dispose();
        if (thing.lookKey) world.releaseLook(thing.lookKey);
        else thing.material?.dispose();
        thing.lookKey = undefined;
    }

    /** Where a thing hangs: inside its parent thing, or in the scripts' group. */
    function attach(thing: Thing, parentId: string | null | undefined) {
        const parent = parentId ? things.get(parentId) : null;
        const target =
            parent && parent !== thing && !isInside(parent.object, thing.object)
                ? parent.object
                : group;
        if (thing.object.parent !== target) target.add(thing.object);
    }

    /** A plain shape the script made solid: its box cannot be walked through. */
    function applySolid(id: string, thing: Thing) {
        const solid =
            thing.props.solid === true &&
            SOLID_SHAPES.includes(thing.props.shape) &&
            thing.geometry;
        if (!solid) {
            if (thing.solid) solids.set(id, thing.object, null);
            thing.solid = false;
            return;
        }
        solids.set(id, thing.object, shapeBoxPositions(thing.geometry));
        thing.solid = true;
    }

    return {
        add(id: string, props: ThingProps) {
            const thing = build(id, props);
            applyTransform(thing.object, props);
            things.set(id, thing);
            objectToThing.set(thing.object, id);
            // in place before it is built: a model, a solid and an opening
            // are made where they stand
            attach(thing, props.parent);
            world.draw(thing);
            applySolid(id, thing);
        },
        /** `glide` animates the change of place over that many seconds. */
        set(id: string, props: ThingProps, glide = 0) {
            const thing = things.get(id);
            if (!thing) return;
            const shapeChanged = BUILT_FROM_KEYS.some(
                (key) =>
                    props[key] !== undefined &&
                    JSON.stringify(props[key]) !==
                        JSON.stringify(thing.props[key])
            );
            thing.props = { ...thing.props, ...props };
            if (shapeChanged && !thing.special) {
                const rebuilt = build(id, thing.props);
                rebuilt.object.position.copy(thing.object.position);
                rebuilt.object.rotation.copy(thing.object.rotation);
                rebuilt.object.scale.copy(thing.object.scale);
                const children = thing.object.children.filter(
                    (child) => child !== thing.outline
                );
                const parent = thing.object.parent || group;
                objectToThing.delete(thing.object);
                dispose(thing, id);
                thing.outline = undefined;
                Object.assign(thing, rebuilt);
                objectToThing.set(thing.object, id);
                parent.add(thing.object);
                children.forEach((child) => thing.object.add(child));
                world.draw(thing);
            }
            if (props.parent !== undefined) attach(thing, props.parent);
            if (glide > 0 && places(props))
                glides.start(id, thing.object, props, glide);
            // A rewind still gliding this object back is aimed at the
            // script's moves instead of being cut short.
            else if (!glides.aim(id, props))
                applyTransform(thing.object, props);
            if (
                changed(LOOK_KEYS, props) ||
                (thing.props.shape === "text" && props.scale) ||
                (thing.special && changed(SPECIAL_KEYS, props))
            )
                world.draw(thing);
            if (places(props)) {
                thing.special?.moved?.();
                if (thing.solid) solids.moved(id);
            }
            if (props.solid !== undefined || shapeChanged)
                applySolid(id, thing);
        },
        remove(id: string) {
            const thing = things.get(id);
            if (!thing) return;
            things.delete(id);
            glides.stop(id);
            objectToThing.delete(thing.object);
            // A part that outlives what it belonged to hangs in the scripts'
            // group (the script's own remove() takes its parts with it).
            thing.object.children
                .filter((child) => objectToThing.has(child))
                .forEach((child) => group.add(child));
            dispose(thing, id);
        },
        /** The id of the thing `object` is, if it is one. */
        idOf(object: Object3D) {
            return objectToThing.get(object);
        },
        /** Every thing drawn again: the world's style changed. */
        redraw() {
            things.forEach((thing) => world.draw(thing));
        },
        /** Once a frame: what follows its holder (an avatar) catches up. */
        frame() {
            things.forEach((thing) => thing.special?.frame?.());
        },
        get size() {
            return things.size;
        },
        dispose() {
            things.forEach((thing, id) => dispose(thing, id));
            things.clear();
        },
    };
}
