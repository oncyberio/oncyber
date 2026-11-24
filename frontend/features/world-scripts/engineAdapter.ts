/**
 * The bridge between WorldScriptHost and the native 3D engine: draws the
 * objects a script asks for in the real scene (so they sit behind walls and
 * work on WebGPU and WebGL alike), reads the player and camera, changes
 * artworks for as long as the script runs, and forwards keys and clicks.
 *
 * Loaded only when a space has scripts and the feature is on.
 */
import {
    BoxGeometry,
    BufferGeometry,
    CanvasTexture,
    Color,
    ConeGeometry,
    CylinderGeometry,
    DoubleSide,
    Group,
    Material,
    Mesh,
    MeshBasicMaterial,
    MeshStandardMaterial,
    Object3D,
    PlaneGeometry,
    Raycaster,
    RingGeometry,
    SphereGeometry,
    Sprite,
    SpriteMaterial,
    SRGBColorSpace,
    TorusGeometry,
    Vector2,
    Vector3,
} from "three";
import Scene from "@3/three/scene";
import Camera from "@3/three/camera";
import Players from "@3/three/factory/player";
import Root from "@3/three/root";
import Emitter from "@3/three/events/emitter";
import Events from "@3/three/events/events";
import { CANVAS } from "@3/three/constants";
import { RenderDemand } from "@3/three/utils/renderDemand";
import type { ArtworkInfo, WorldScriptSink, WorldView } from "./host";
import type { HudCorner, SoundName, ThingProps, Vec3 } from "./protocol";
import { playSound } from "./sounds";

export interface InterfaceSink {
    hud(key: string, text: string | null, corner: HudCorner): void;
    clearHud(): void;
    toast(text: string, seconds: number): void;
    banner(text: string | null, seconds: number): void;
}

interface Thing {
    object: Object3D;
    props: ThingProps;
    material: Material;
    texture?: CanvasTexture;
    geometry?: BufferGeometry;
}

interface Glide {
    object: Object3D;
    from: { p: Vector3; r: Vector3; s: Vector3 };
    to: { p: Vector3; r: Vector3; s: Vector3 };
    elapsed: number;
    seconds: number;
}

interface ArtworkOriginal {
    object: Object3D;
    position: Vector3;
    rotation: Vector3;
    scale: Vector3;
    visible: boolean;
}

const RENDER_SOURCE = "world-scripts";
const v = new Vector3();

function artworkId(artwork: any): string {
    return String(
        artwork?.data?.id ?? artwork?.item?.id ?? artwork?.uuid ?? ""
    );
}

function liveArtworks(): any[] {
    try {
        return (Root as any).getArtworks?.() || [];
    } catch {
        return [];
    }
}

/** The world is showing: a player and a camera are in place. */
export function engineReady() {
    try {
        return !!(Players as any).main && !!Camera.current && !!CANVAS;
    } catch {
        return false;
    }
}

function geometryFor(shape: ThingProps["shape"], size: Vec3): BufferGeometry {
    const [x, y, z] = size;
    switch (shape) {
        case "sphere":
            return new SphereGeometry(x / 2, 24, 16);
        case "cylinder":
            return new CylinderGeometry(x / 2, x / 2, y, 24);
        case "cone":
            return new ConeGeometry(x / 2, y, 24);
        case "torus":
            return new TorusGeometry(x / 2, Math.max(0.01, z / 6), 12, 32);
        case "ring":
            return new RingGeometry(x / 4, x / 2, 32);
        case "plane":
            return new PlaneGeometry(x, y);
        default:
            return new BoxGeometry(x, y, z);
    }
}

function drawText(props: ThingProps, texture?: CanvasTexture) {
    const canvas =
        (texture?.image as HTMLCanvasElement) ||
        document.createElement("canvas");
    const text = props.text || "";
    const lines = text.split("\n").slice(0, 6);
    const font = 64;
    const context = canvas.getContext("2d");
    context.font = `600 ${font}px Aeonik, "Helvetica Neue", Arial, sans-serif`;
    const width = Math.max(
        64,
        ...lines.map((line) => context.measureText(line).width)
    );
    canvas.width = Math.ceil(width + font);
    canvas.height = Math.ceil(lines.length * font * 1.25 + font * 0.5);
    context.font = `600 ${font}px Aeonik, "Helvetica Neue", Arial, sans-serif`;
    if (props.background) {
        context.fillStyle = props.background;
        context.fillRect(0, 0, canvas.width, canvas.height);
    }
    context.fillStyle = props.textColor || "#ffffff";
    context.textBaseline = "top";
    context.textAlign = "center";
    lines.forEach((line, i) =>
        context.fillText(line, canvas.width / 2, font * 0.25 + i * font * 1.25)
    );
    const next = texture || new CanvasTexture(canvas);
    next.colorSpace = SRGBColorSpace;
    next.needsUpdate = true;
    return { texture: next, aspect: canvas.width / canvas.height };
}

export function createEngineSink(ui: InterfaceSink, api?: any) {
    const group = new Group();
    group.name = "world-scripts";
    Scene.add(group);
    const things = new Map<string, Thing>();
    const glides = new Map<string, Glide>();
    const originals = new Map<string, ArtworkOriginal>();
    const objectToThing = new Map<Object3D, string>();

    function findArtwork(id: string) {
        return liveArtworks().find((artwork) => artworkId(artwork) === id);
    }

    function applyTransform(object: Object3D, props: ThingProps) {
        if (props.position) object.position.fromArray(props.position);
        if (props.rotation)
            object.rotation.set(
                props.rotation[0],
                props.rotation[1],
                props.rotation[2]
            );
        if (props.scale) object.scale.fromArray(props.scale);
    }

    function applyLook(thing: Thing) {
        const { props } = thing;
        if (props.shape === "text") {
            const { texture, aspect } = drawText(props, thing.texture);
            thing.texture = texture;
            const material = thing.material as
                | SpriteMaterial
                | MeshBasicMaterial;
            material.map = texture;
            material.transparent = true;
            material.opacity = props.opacity ?? 1;
            material.needsUpdate = true;
            const height = props.size?.[1] ?? 0.5;
            const base = props.scale ?? [1, 1, 1];
            thing.object.scale.set(
                height * aspect * base[0],
                height * base[1],
                base[2]
            );
        } else {
            const material = thing.material as MeshStandardMaterial;
            const color = new Color(props.color || "#ffffff");
            material.color.copy(color);
            material.emissive?.copy(props.glow ? color : new Color(0));
            material.emissiveIntensity = props.glow ? 1 : 0;
            const opacity = props.opacity ?? 1;
            material.opacity = opacity;
            material.transparent = opacity < 1;
        }
        thing.object.visible = props.visible !== false;
    }

    function build(id: string, props: ThingProps): Thing {
        let object: Object3D;
        let material: Material;
        let geometry: BufferGeometry;
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
            const size = props.size ?? [1, 1, 1];
            geometry = geometryFor(props.shape, size);
            material = new MeshStandardMaterial({
                roughness: 0.55,
                metalness: 0.05,
                side:
                    props.shape === "plane" || props.shape === "ring"
                        ? DoubleSide
                        : undefined,
            });
            object = new Mesh(geometry, material);
        }
        object.name = `world-script:${id}`;
        return { object, props: { ...props }, material, geometry };
    }

    function dispose(thing: Thing) {
        thing.object.removeFromParent();
        thing.geometry?.dispose();
        thing.texture?.dispose();
        thing.material.dispose();
    }

    const sink: WorldScriptSink = {
        view(): WorldView {
            const camera = Camera.current;
            const forward = camera
                ? camera.getWorldDirection(new Vector3())
                : new Vector3(0, 0, -1);
            const cameraPosition = camera
                ? camera.getWorldPosition(new Vector3())
                : new Vector3();
            const main = (Players as any).main;
            const position = main?.position ?? cameraPosition;
            const flat = new Vector3(forward.x, 0, forward.z);
            if (flat.lengthSq() > 0) flat.normalize();
            return {
                player: {
                    position: [position.x, position.y, position.z],
                    forward: [flat.x, flat.y, flat.z],
                    yaw: Math.atan2(flat.x, flat.z),
                },
                camera: {
                    position: [
                        cameraPosition.x,
                        cameraPosition.y,
                        cameraPosition.z,
                    ],
                    forward: [forward.x, forward.y, forward.z],
                },
            };
        },
        artworks(): ArtworkInfo[] {
            return liveArtworks()
                .slice(0, 500)
                .map((artwork) => {
                    const original = originals.get(artworkId(artwork));
                    const object: Object3D = artwork;
                    const position = object.getWorldPosition(new Vector3());
                    return {
                        id: artworkId(artwork),
                        name: String(artwork?.data?.name ?? "").slice(0, 120),
                        type: String(
                            artwork?.mediaType ?? artwork?.data?.type ?? ""
                        ),
                        position: [position.x, position.y, position.z],
                        rotation: original
                            ? [
                                  original.rotation.x,
                                  original.rotation.y,
                                  original.rotation.z,
                              ]
                            : [
                                  object.rotation.x,
                                  object.rotation.y,
                                  object.rotation.z,
                              ],
                        scale: [object.scale.x, object.scale.y, object.scale.z],
                        visible: original
                            ? original.visible
                            : object.visible !== false,
                    } as ArtworkInfo;
                })
                .filter((artwork) => artwork.id);
        },
        addThing(id, props) {
            const thing = build(id, props);
            applyTransform(thing.object, props);
            applyLook(thing);
            things.set(id, thing);
            objectToThing.set(thing.object, id);
            group.add(thing.object);
        },
        setThing(id, props, glide = 0) {
            const thing = things.get(id);
            if (!thing) return;
            const shapeChanged =
                (props.size &&
                    JSON.stringify(props.size) !==
                        JSON.stringify(thing.props.size)) ||
                (props.billboard != null &&
                    props.billboard !== thing.props.billboard);
            thing.props = { ...thing.props, ...props };
            if (shapeChanged) {
                const rebuilt = build(id, thing.props);
                rebuilt.object.position.copy(thing.object.position);
                rebuilt.object.rotation.copy(thing.object.rotation);
                rebuilt.object.scale.copy(thing.object.scale);
                objectToThing.delete(thing.object);
                dispose(thing);
                Object.assign(thing, rebuilt);
                objectToThing.set(thing.object, id);
                group.add(thing.object);
            }
            if (
                glide > 0 &&
                (props.position || props.rotation || props.scale)
            ) {
                const o = thing.object;
                const to = new Object3D();
                to.position.copy(o.position);
                to.rotation.copy(o.rotation);
                to.scale.copy(o.scale);
                applyTransform(to, props);
                glides.set(id, {
                    object: o,
                    from: {
                        p: o.position.clone(),
                        r: new Vector3(
                            o.rotation.x,
                            o.rotation.y,
                            o.rotation.z
                        ),
                        s: o.scale.clone(),
                    },
                    to: {
                        p: to.position.clone(),
                        r: new Vector3(
                            to.rotation.x,
                            to.rotation.y,
                            to.rotation.z
                        ),
                        s: to.scale.clone(),
                    },
                    elapsed: 0,
                    seconds: glide,
                });
            } else if (glides.has(id)) {
                // A rewind is still gliding this object back: the script's
                // moves aim the glide instead of cutting it short.
                const target = glides.get(id).to;
                if (props.position) target.p.fromArray(props.position);
                if (props.rotation) target.r.fromArray(props.rotation);
                if (props.scale) target.s.fromArray(props.scale);
            } else {
                applyTransform(thing.object, props);
            }
            if (
                props.color != null ||
                props.text != null ||
                props.opacity != null ||
                props.glow != null ||
                props.visible != null ||
                props.textColor != null ||
                props.background != null ||
                (thing.props.shape === "text" && props.scale)
            )
                applyLook(thing);
        },
        removeThing(id) {
            const thing = things.get(id);
            if (!thing) return;
            things.delete(id);
            glides.delete(id);
            objectToThing.delete(thing.object);
            dispose(thing);
        },
        setArtwork(id, props) {
            const artwork = findArtwork(id);
            if (!artwork) return;
            const object: Object3D = artwork;
            if (!originals.has(id))
                originals.set(id, {
                    object,
                    position: object.position.clone(),
                    rotation: new Vector3(
                        object.rotation.x,
                        object.rotation.y,
                        object.rotation.z
                    ),
                    scale: object.scale.clone(),
                    visible: object.visible,
                });
            if (props.position) {
                // Scripts speak world coordinates; artworks sit in a parent.
                v.fromArray(props.position);
                if (object.parent) object.parent.worldToLocal(v);
                object.position.copy(v);
            }
            if (props.rotation)
                object.rotation.set(
                    props.rotation[0],
                    props.rotation[1],
                    props.rotation[2]
                );
            if (props.scale) object.scale.fromArray(props.scale);
            if (props.visible != null) object.visible = props.visible;
        },
        resetArtworks() {
            originals.forEach((original) => {
                original.object.position.copy(original.position);
                original.object.rotation.set(
                    original.rotation.x,
                    original.rotation.y,
                    original.rotation.z
                );
                original.object.scale.copy(original.scale);
                original.object.visible = original.visible;
            });
            originals.clear();
        },
        movePlayer(position) {
            try {
                (Root as any).teleport?.({
                    position: {
                        x: position[0],
                        y: position[1],
                        z: position[2],
                    },
                });
            } catch {
                /* the controls refuse a move while travelling: ignore */
            }
        },
        hud: ui.hud,
        clearHud: ui.clearHud,
        toast: ui.toast,
        banner: ui.banner,
        sound(name: SoundName, volume: number) {
            playSound(name, volume);
        },
    };

    // Frames, keys and clicks.
    let onFrame: ((dt: number) => void) | null = null;
    let onKey: ((down: boolean, key: string, code: string) => void) | null =
        null;
    let onClick:
        | ((hit: { thing?: string; artwork?: string; point?: Vec3 }) => void)
        | null = null;

    const update = (delta: number) => {
        glides.forEach((glide, id) => {
            glide.elapsed += delta;
            const t = Math.min(1, glide.elapsed / glide.seconds);
            const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
            glide.object.position.lerpVectors(glide.from.p, glide.to.p, e);
            v.lerpVectors(glide.from.r, glide.to.r, e);
            glide.object.rotation.set(v.x, v.y, v.z);
            glide.object.scale.lerpVectors(glide.from.s, glide.to.s, e);
            if (t >= 1) glides.delete(id);
        });
        onFrame?.(delta);
    };
    Emitter.on(Events.UPDATE, update);
    RenderDemand.setContinuous(RENDER_SOURCE, true);

    const typing = (target: EventTarget | null) => {
        const element = target as HTMLElement;
        return (
            !!element &&
            (element.isContentEditable ||
                ["INPUT", "TEXTAREA", "SELECT"].includes(element.tagName))
        );
    };
    const keydown = (event: KeyboardEvent) => {
        if (event.repeat || typing(event.target)) return;
        onKey?.(true, event.key, event.code);
    };
    const keyup = (event: KeyboardEvent) => {
        if (typing(event.target)) return;
        onKey?.(false, event.key, event.code);
    };
    window.addEventListener("keydown", keydown);
    window.addEventListener("keyup", keyup);

    const raycaster = new Raycaster();
    let pressed: { x: number; y: number } | null = null;
    const pointerdown = (event: PointerEvent) => {
        pressed = { x: event.clientX, y: event.clientY };
    };
    const pointerup = (event: PointerEvent) => {
        if (!pressed) return;
        const moved = Math.hypot(
            event.clientX - pressed.x,
            event.clientY - pressed.y
        );
        pressed = null;
        if (moved > 6 || !onClick || !Camera.current) return;
        const canvas = CANVAS as HTMLCanvasElement;
        const rect = canvas?.getBoundingClientRect();
        const ndc = new Vector2(0, 0);
        if (!document.pointerLockElement && rect?.width) {
            ndc.set(
                ((event.clientX - rect.left) / rect.width) * 2 - 1,
                -((event.clientY - rect.top) / rect.height) * 2 + 1
            );
        }
        raycaster.setFromCamera(ndc, Camera.current);
        const artworks = liveArtworks();
        const targets: Object3D[] = [...group.children, ...artworks];
        const hit = raycaster.intersectObjects(targets, true)[0];
        if (!hit) return;
        const point: Vec3 = [hit.point.x, hit.point.y, hit.point.z];
        let node: Object3D | null = hit.object;
        const artworkSet = new Set<Object3D>(artworks);
        while (node) {
            const thing = objectToThing.get(node);
            if (thing) return onClick({ thing, point });
            if (artworkSet.has(node))
                return onClick({ artwork: artworkId(node), point });
            node = node.parent;
        }
    };
    const canvas = CANVAS as HTMLCanvasElement;
    canvas?.addEventListener("pointerdown", pointerdown);
    canvas?.addEventListener("pointerup", pointerup);

    return {
        sink,
        api,
        bind(handlers: {
            frame: (dt: number) => void;
            key: (down: boolean, key: string, code: string) => void;
            click: (hit: {
                thing?: string;
                artwork?: string;
                point?: Vec3;
            }) => void;
        }) {
            onFrame = handlers.frame;
            onKey = handlers.key;
            onClick = handlers.click;
        },
        dispose() {
            Emitter.off?.(Events.UPDATE, update);
            RenderDemand.setContinuous(RENDER_SOURCE, false);
            window.removeEventListener("keydown", keydown);
            window.removeEventListener("keyup", keyup);
            canvas?.removeEventListener("pointerdown", pointerdown);
            canvas?.removeEventListener("pointerup", pointerup);
            things.forEach(dispose);
            things.clear();
            sink.resetArtworks();
            group.removeFromParent();
        },
    };
}
