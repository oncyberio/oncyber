import * as THREE from "three";

/** A 2D canvas: the browser's by default, or the host's in a page without a DOM. */
export type CanvasFactory = (width: number, height: number) => any;
const domCanvas: CanvasFactory = (width, height) =>
    Object.assign(document.createElement("canvas"), { width, height });

const PLATE_HEIGHT = 0.2; // metres
const FONT = '600 52px system-ui, -apple-system, "Segoe UI", sans-serif';

function plate(name: string, make: CanvasFactory) {
    const probe = make(8, 8).getContext("2d");
    probe.font = FONT;
    const width = Math.ceil(
        Math.min(640, Math.max(96, probe.measureText(name).width + 56))
    );
    const canvas = make(width, 96);
    const c = canvas.getContext("2d");
    c.fillStyle = "rgba(12, 14, 24, 0.72)";
    c.beginPath();
    c.roundRect?.(0, 8, width, 80, 40);
    if (!c.roundRect) c.rect(0, 8, width, 80);
    c.fill();
    c.font = FONT;
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillStyle = "#ffffff";
    c.fillText(name, width / 2, 50, width - 40);
    return { canvas, aspect: width / 96 };
}

// Three bars in a green disc: someone is talking.
function talkingIcon(make: CanvasFactory) {
    const canvas = make(96, 96);
    const c = canvas.getContext("2d");
    c.fillStyle = "#2fd67b";
    c.beginPath();
    c.arc(48, 48, 40, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "#06220f";
    [
        [30, 22],
        [44, 40],
        [58, 28],
    ].forEach(([x, h]) => c.fillRect(x, 48 - h / 2, 9, h));
    return canvas;
}

export interface NameTag {
    /** Add this above the avatar's head. Sprites face the camera on their own. */
    readonly object: THREE.Group;
    readonly name: string;
    readonly talking: boolean;
    setName(name: string): void;
    setTalking(talking: boolean): void;
    update(seconds: number): void;
    dispose(): void;
}

/** A name plate with a talking indicator above it. */
export function createNameTag(
    name: string,
    options: { canvas?: CanvasFactory } = {}
): NameTag {
    const make = options.canvas ?? domCanvas;
    const object = new THREE.Group();
    object.name = "name-tag";
    const material = (canvas: any) => {
        const map = new THREE.CanvasTexture(canvas);
        map.colorSpace = THREE.SRGBColorSpace;
        // Tags read through walls and scenery, like the lobby's.
        return new THREE.SpriteMaterial({
            map,
            transparent: true,
            depthTest: false,
            depthWrite: false,
        });
    };
    const label = new THREE.Sprite();
    label.renderOrder = 10;
    const icon = new THREE.Sprite(material(talkingIcon(make)));
    icon.renderOrder = 11;
    icon.visible = false;
    object.add(label, icon);
    let current = "",
        talking = false,
        pulse = 0;
    // Above the plate, so it reads the same from every side.
    icon.position.y = PLATE_HEIGHT * 1.15;
    const tag: NameTag = {
        object,
        get name() {
            return current;
        },
        get talking() {
            return talking;
        },
        setName(next) {
            const text = String(next || "Visitor").slice(0, 24);
            if (text === current) return;
            current = text;
            const { canvas, aspect } = plate(text, make);
            label.material.map?.dispose();
            label.material.dispose();
            label.material = material(canvas);
            label.scale.set(PLATE_HEIGHT * aspect, PLATE_HEIGHT, 1);
        },
        setTalking(next) {
            talking = Boolean(next);
            icon.visible = talking;
            if (!talking) pulse = 0;
        },
        update(seconds) {
            if (!talking) return;
            pulse += seconds * 9;
            icon.scale.setScalar(
                PLATE_HEIGHT * (0.95 + 0.14 * Math.sin(pulse))
            );
        },
        dispose() {
            for (const sprite of [label, icon]) {
                sprite.material.map?.dispose();
                sprite.material.dispose();
            }
            object.parent?.remove(object);
        },
    };
    icon.scale.setScalar(PLATE_HEIGHT);
    tag.setName(name);
    return tag;
}
