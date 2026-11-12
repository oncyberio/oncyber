import Loader from "@3loader";
import { disposeObject3D } from "@3utils/three";

// A small per-world warm cache shares the same request with drag and insertion.
// Warm entries have no instance references and are evicted first.
const MAX_WARM_MODELS = 3;

export class ModelFactoryManager {
    constructor() {
        this.map = new Map();
        this.clock = 0;
    }

    request(src, opts) {
        const sceneId = opts.exhibit.id;
        if (!this.map.has(sceneId)) this.map.set(sceneId, {});
        const scene = this.map.get(sceneId);
        if (scene[src]) return scene[src];
        const request = { count: 0, object: null, lastUsed: ++this.clock };
        scene[src] = request;
        // A caller cancelling its drag must not cancel a shared model request.
        request.promise = Loader.loadGLTFAsset([src], opts.fromEdit).then(
            (object) => {
                request.object = object;
                this.trim(sceneId);
                return object;
            },
            (error) => {
                if (scene[src] === request) delete scene[src];
                throw error;
            }
        );
        return request;
    }

    async preload(src, opts) {
        const request = this.request(src, opts);
        request.lastUsed = ++this.clock;
        return request.promise;
    }

    async load(src, opts) {
        const request = this.request(src, opts);
        request.count++;
        return request.promise;
    }

    trim(sceneId) {
        const scene = this.map.get(sceneId);
        if (!scene) return;
        const warm = Object.entries(scene)
            .filter(([, entry]) => entry.count === 0 && entry.object)
            .sort((a, b) => b[1].lastUsed - a[1].lastUsed);
        for (const [src, entry] of warm.slice(MAX_WARM_MODELS)) {
            disposeObject3D(entry.object.scene);
            delete scene[src];
        }
    }

    cleanScene(sceneId) {
        const scene = this.map.get(sceneId);
        if (scene) {
            for (const entry of Object.values(scene)) {
                if (entry.count === 0 && entry.object)
                    disposeObject3D(entry.object.scene);
            }
        }
        this.map.delete(sceneId);
    }

    dispose(object, src, opts) {
        const scene = this.map.get(opts.exhibit.id);
        const request = scene?.[src];
        if (request) request.count--;
        if (!request || request.count <= 0) {
            disposeObject3D(object);
            if (scene) delete scene[src];
            return true;
        }
        return false;
    }
}

export default new ModelFactoryManager();
