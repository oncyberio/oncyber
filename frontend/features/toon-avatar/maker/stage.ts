import * as THREE from "three/webgpu";
import { float as tslFloat, length, smoothstep, uv, vec4 } from "three/tsl";
import { ToonAvatar } from "../three/avatar";
import {
    ToonAnimator,
    ToonSecondaryMotion,
    type ToonMotion,
} from "../three/motion";
import type { ToonAvatarRecipe } from "../recipe";

export type StageFocus = "body" | "head" | "torso" | "legs";

type Framing = { target: THREE.Vector3; distance: number };

const FOV = 28;

/**
 * The maker's 3D view: one avatar on a soft floor shadow, an orbiting camera
 * that frames whatever is being edited, and the render loop. No React here,
 * so the page can mount it on a canvas and drive it with plain calls.
 */
export class ToonAvatarStage {
    readonly avatar: ToonAvatar;
    readonly animator: ToonAnimator;

    private renderer: THREE.WebGPURenderer;
    private scene = new THREE.Scene();
    private camera = new THREE.PerspectiveCamera(FOV, 1, 0.05, 60);
    private secondary: ToonSecondaryMotion;
    private shadow: THREE.Mesh;
    private clock = new THREE.Clock();
    private frame = 0;
    private disposed = false;
    private ready: Promise<void>;

    private yaw = -0.35;
    private pitch = 0.06;
    private zoom = 1;
    private focus: StageFocus = "body";
    private goal: Framing = { target: new THREE.Vector3(), distance: 4 };
    private now: Framing = { target: new THREE.Vector3(), distance: 4 };
    private turntable = false;
    private reducedMotion = false;
    /** Pixels of the canvas covered by bars at the top and bottom. */
    private insetTop = 64;
    private insetBottom = 64;

    constructor(
        private canvas: HTMLCanvasElement,
        recipe: ToonAvatarRecipe,
        options: { forceWebGL?: boolean; reducedMotion?: boolean } = {}
    ) {
        this.reducedMotion = !!options.reducedMotion;
        this.renderer = new THREE.WebGPURenderer({
            canvas,
            antialias: true,
            alpha: true,
            forceWebGL: !!options.forceWebGL,
        });
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.toneMapping = THREE.NoToneMapping;
        this.renderer.setClearColor(0x000000, 0);

        this.avatar = new ToonAvatar(recipe);
        this.scene.add(this.avatar.root);
        const bone = (name: string) =>
            this.avatar.bones[name as keyof ToonAvatar["bones"]];
        this.animator = new ToonAnimator(bone, this.avatar.layout);
        this.secondary = new ToonSecondaryMotion(this.avatar.root, bone);

        // A soft dark pool under the feet grounds the figure.
        const material = new THREE.MeshBasicNodeMaterial({
            transparent: true,
            depthWrite: false,
        });
        const falloff = smoothstep(0.5, 0.08, length(uv().sub(0.5)));
        material.colorNode = vec4(0, 0, 0, falloff.mul(tslFloat(0.42)));
        this.shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material);
        this.shadow.rotation.x = -Math.PI / 2;
        this.shadow.position.y = 0.001;
        this.scene.add(this.shadow);

        this.frameAvatar(true);
        this.ready = this.renderer.init().then(() => {
            if (this.disposed) return;
            this.resize();
            this.clock.start();
            this.renderer.setAnimationLoop(() => this.tick());
        });
    }

    whenReady() {
        return this.ready;
    }

    /** The graphics backend in use, for diagnostics. */
    get backend(): "webgpu" | "webgl" {
        return (this.renderer.backend as { isWebGPUBackend?: boolean })
            .isWebGPUBackend
            ? "webgpu"
            : "webgl";
    }

    setRecipe(recipe: ToonAvatarRecipe) {
        this.avatar.setRecipe(recipe);
        this.animator.setLayout(this.avatar.layout);
        this.frameAvatar(false);
    }

    setMotion(motion: ToonMotion) {
        this.animator.play(motion);
    }

    setFocus(focus: StageFocus) {
        if (focus === this.focus) return;
        this.focus = focus;
        this.zoom = 1;
        this.frameAvatar(false);
    }

    setTurntable(on: boolean) {
        this.turntable = on;
    }

    /** Pointer drag: radians of yaw and pitch. */
    orbit(dYaw: number, dPitch: number) {
        this.yaw += dYaw;
        this.pitch = Math.max(-0.35, Math.min(0.9, this.pitch + dPitch));
    }

    zoomBy(factor: number) {
        this.zoom = Math.max(0.45, Math.min(1.6, this.zoom * factor));
    }

    resetView() {
        this.yaw = -0.35;
        this.pitch = 0.06;
        this.zoom = 1;
    }

    private frameAvatar(snap: boolean) {
        const { layout } = this.avatar;
        const top = layout.height + layout.head.size * 0.7;
        const head = layout.head;
        const tan = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
        const viewHeight = this.canvas.clientHeight || 1;
        // The bars over the canvas take room at the top and bottom.
        const usable = Math.max(
            0.4,
            1 - (this.insetTop + this.insetBottom) / viewHeight
        );
        const span = (from: number, to: number, width: number): Framing => {
            const aspect = this.camera.aspect || 1;
            const distance = Math.max(
                ((to - from) * 1.08) / usable / 2 / tan,
                (width * 1.1) / 2 / tan / aspect
            );
            const shift =
                ((this.insetTop - this.insetBottom) / viewHeight) *
                distance *
                tan;
            return {
                target: new THREE.Vector3(
                    0,
                    (from + to) / 2 + shift,
                    layout.torso.lean * 0.5
                ),
                distance,
            };
        };
        const headWidth = head.halfWidth * 2 + head.size * 1.6;
        const framing =
            this.focus === "head"
                ? span(
                      head.center[1] - head.down * 1.9,
                      top + head.size * 0.5,
                      headWidth
                  )
                : this.focus === "torso"
                ? span(layout.torso.bottom - 0.1, top, headWidth)
                : this.focus === "legs"
                ? span(0, layout.torso.bottom + 0.25, 0.7)
                : span(0, top, 0.9);
        this.goal = framing;
        if (snap)
            this.now = {
                target: framing.target.clone(),
                distance: framing.distance,
            };
        const reach = Math.max(layout.torso.hips, layout.torso.shoulder) * 4.2;
        this.shadow.scale.set(reach, reach * 0.8, 1);
    }

    resize() {
        const width = this.canvas.clientWidth || 1;
        const height = this.canvas.clientHeight || 1;
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        this.renderer.setSize(width, height, false);
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.frameAvatar(false);
    }

    private tick() {
        if (this.disposed) return;
        const dt = Math.min(this.clock.getDelta(), 0.1);
        this.frame++;
        if (this.turntable && !this.reducedMotion) this.yaw += dt * 0.6;

        this.animator.update(dt);
        this.avatar.root.updateMatrixWorld(true);
        this.secondary.update(dt);
        this.avatar.setExpression(this.animator.expression);

        const k = this.reducedMotion ? 1 : 1 - Math.exp(-dt * 7);
        this.now.target.lerp(this.goal.target, k);
        this.now.distance += (this.goal.distance - this.now.distance) * k;
        const distance = this.now.distance * this.zoom;
        const target = this.now.target;
        const cosPitch = Math.cos(this.pitch);
        this.camera.position.set(
            target.x + Math.sin(this.yaw) * cosPitch * distance,
            target.y + Math.sin(this.pitch) * distance,
            target.z + Math.cos(this.yaw) * cosPitch * distance
        );
        this.camera.lookAt(target);
        this.renderer.render(this.scene, this.camera);
    }

    /** The current view as a PNG, for a profile picture or a share image. */
    async snapshot(): Promise<Blob | null> {
        await this.ready;
        this.tick();
        return new Promise((resolve) =>
            this.canvas.toBlob(resolve, "image/png")
        );
    }

    dispose() {
        this.disposed = true;
        this.renderer.setAnimationLoop(null);
        this.avatar.dispose();
        this.shadow.geometry.dispose();
        (this.shadow.material as THREE.Material).dispose();
        this.renderer.dispose();
    }
}
