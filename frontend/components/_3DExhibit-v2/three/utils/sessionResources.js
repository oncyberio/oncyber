import { releaseArtworkVideo } from "@utils/media/video";

// Stamps on drawn geometries and materials: which visit tracked them and in
// which second a material's textures were last scanned. Symbol keys stay out
// of Object.values, copy() and JSON.
const TRACKED = Symbol("sessionResources.tracked");
const SCANNED = Symbol("sessionResources.scanned");

// Visits and scan periods are numbered from one counter, so a stamp left by
// an earlier visit never matches a later one.
let stamps = 0;

/** Own GPU resources used by a visit, including detached helper meshes and offscreen passes. */
export class SessionResources {
    constructor() {
        this.active = false;
        this.resources = new Set();
        this.visit = 0;
        // Per-draw hot path: a material's textures are rescanned at most once
        // per period, and `period` advances once a second, off the draw path.
        this.period = 0;
        this.clock = null;
        this.onDispose = ({ target }) => this.forget(target);
    }
    begin() {
        this.active = true;
        this.visit = ++stamps;
        this.period = ++stamps;
        if (this.clock == null && typeof setInterval === "function") {
            this.clock = setInterval(() => (this.period = ++stamps), 1000);
            this.clock?.unref?.();
        }
    }
    track(resource) {
        if (!this.active || !resource?.dispose || this.resources.has(resource))
            return;
        this.resources.add(resource);
        resource.addEventListener?.("dispose", this.onDispose);
    }
    /** A disposed resource is no longer ours; reuse after GPU invalidation tracks it again. */
    forget(resource) {
        this.resources.delete(resource);
        delete resource[TRACKED];
        delete resource[SCANNED];
        resource.removeEventListener?.("dispose", this.onDispose);
    }
    /** track() for objects seen on every draw: one stamp check when known. */
    drawn(resource) {
        if (!this.active || !resource || resource[TRACKED] === this.visit)
            return;
        resource[TRACKED] = this.visit;
        this.track(resource);
    }
    material(material) {
        if (!this.active || !material || material[SCANNED] === this.period)
            return;
        material[SCANNED] = this.period;
        this.track(material);
        for (const value of Object.values(material))
            if (value?.isTexture) this.track(value);
        for (const uniform of Object.values(material.uniforms || {})) {
            const values = Array.isArray(uniform?.value)
                ? uniform.value
                : [uniform?.value];
            for (const value of values) if (value?.isTexture) this.track(value);
        }
    }
    end() {
        // A live material can replace a map or invalidate a video texture between
        // throttled scans. Capture its final samplers before ending ownership.
        this.period = ++stamps;
        for (const resource of [...this.resources])
            if (resource.isMaterial) this.material(resource);
        this.active = false;
        if (this.clock != null) clearInterval(this.clock);
        this.clock = null;
        const resources = [...this.resources];
        // Drop ownership before disposing: resource events can fire synchronously.
        for (const resource of resources) this.forget(resource);
        for (const resource of resources) {
            try {
                const media = resource.isTexture ? resource.image : null;
                if (media && typeof media.pause === "function") {
                    media.srcObject
                        ?.getTracks?.()
                        .forEach((track) => track.stop());
                    releaseArtworkVideo(media);
                }
                resource.dispose();
            } catch (error) {
                console.error("GPU resource cleanup failed", error);
            }
        }
    }
}
export function ownRendererResources(renderer, owner) {
    // WebGPURenderer funnels every draw through renderObject(object, scene,
    // camera, geometry, material, group, lightsNode, clippingContext,
    // passId). This runs for every draw of every frame: fixed arguments (no
    // rest array) and a stamp check for what this visit already tracks.
    const draw = renderer.renderObject;
    renderer.renderObject = function (
        object,
        scene,
        camera,
        geometry,
        material,
        group,
        lightsNode,
        clippingContext,
        passId
    ) {
        owner.drawn(geometry);
        owner.material(material);
        return draw.call(
            this,
            object,
            scene,
            camera,
            geometry,
            material,
            group,
            lightsNode,
            clippingContext,
            passId
        );
    };
    const target = renderer.setRenderTarget;
    renderer.setRenderTarget = function (renderTarget, ...args) {
        owner.track(renderTarget);
        return target.call(this, renderTarget, ...args);
    };
    const texture = renderer.initTexture;
    renderer.initTexture = function (value) {
        owner.track(value);
        return texture.call(this, value);
    };
}
export const legacyGpuResources = new SessionResources();
