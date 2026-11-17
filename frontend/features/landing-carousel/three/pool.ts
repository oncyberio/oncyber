import {
    Mesh,
    PlaneGeometry,
    TextureLoader,
    CanvasTexture,
    ImageBitmapLoader,
    Texture,
    Group,
    ShaderMaterial,
} from "three";
import { LandingCard } from "../types";
import {
    cellDimensions,
    CylinderMetrics,
    GridCell,
    columnOpacity,
} from "./layout";
import { createCardMaterial, configureCardTexture } from "./createCardMaterial";
import { coverSources } from "../coverSources";
import { collageStrips, coverFit } from "./collage";

interface Slot {
    mesh: Mesh<PlaneGeometry, ShaderMaterial>;
    key: string;
    cardId: string;
    url: string;
}

/** A bounded set of meshes and textures, independent of how long the feed gets. */
export class CardPool {
    group = new Group();
    private slots: Slot[] = [];
    private textures = new Map<string, Texture>();
    private pending = new Map<string, Promise<Texture | null>>();
    private failed = new Set<string>();
    private loader = new TextureLoader();
    // Covers decode off the main thread, so scrolling into new cards doesn't
    // stall on image decoding. Falls back to <img> decoding where unsupported.
    private bitmaps =
        typeof createImageBitmap === "function"
            ? new ImageBitmapLoader().setOptions({
                  imageOrientation: "flipY",
                  premultiplyAlpha: "none",
              })
            : null;
    private geometry = new PlaneGeometry(1, 1, 32, 4);
    private disposed = false;
    private invalidate: () => void;

    constructor(
        invalidate: () => void,
        private onLoading: (busy: boolean) => void = () => {}
    ) {
        this.invalidate = invalidate;
        for (let i = 0; i < 32; i++) {
            const mesh = new Mesh(this.geometry, createCardMaterial());
            mesh.visible = false;
            mesh.frustumCulled = false; // Vertex shader supplies the final position.
            this.group.add(mesh);
            this.slots.push({ mesh, key: "", cardId: "", url: "" });
        }
    }

    update(
        cards: LandingCard[],
        cells: GridCell[],
        metrics: CylinderMetrics,
        progress: number,
        hovered: string,
        opacity: (index: number) => number = () => 1
    ) {
        const visible = cells.filter(
            (cell) =>
                Math.abs(cellDimensions(cell, metrics, progress).x) <
                metrics.width / 2 + metrics.cardWidth
        );
        const keys = new Map(
            visible.map((cell) => {
                const card = cards[cell.index];
                return [
                    cell.index,
                    JSON.stringify([card.id, card.imageUrls, card.collage]),
                ];
            })
        );
        const visibleKeys = new Set(keys.values());
        const used = new Set<Slot>();
        for (const cell of visible) {
            const card = cards[cell.index];
            const key = keys.get(cell.index);
            let slot = this.slots.find((candidate) => candidate.key === key);
            if (!slot)
                slot = this.slots.find(
                    (candidate) =>
                        candidate.cardId === card.id &&
                        !used.has(candidate) &&
                        !visibleKeys.has(candidate.key)
                );
            if (!slot)
                slot = this.slots.find(
                    (candidate) =>
                        !used.has(candidate) && !visibleKeys.has(candidate.key)
                );
            if (!slot) continue;
            used.add(slot);
            if (slot.key !== key) {
                const sameWorld = slot.cardId === card.id;
                slot.key = key;
                slot.cardId = card.id;
                // A cover revision can load over its own existing image, never another world's.
                if (!sameWorld) {
                    slot.url = "";
                    slot.mesh.material.uniforms.ready.value = 0;
                    slot.mesh.material.uniforms.map.value = null;
                }
                this.assignTexture(slot, card);
            }
            const dims = cellDimensions(cell, metrics, progress);
            const uniforms = slot.mesh.material.uniforms;
            uniforms.center.value.set(
                dims.x,
                dims.y + metrics.captionHeight / 2 - 0.5
            );
            uniforms.cardSize.value.set(
                dims.width,
                dims.height - metrics.captionHeight + 1
            );
            uniforms.opacity.value =
                columnOpacity(cell.column, progress, metrics.columns) *
                opacity(cell.index);
            uniforms.radius.value = metrics.radius;
            uniforms.cornerRadius.value = metrics.cardRadius;
            uniforms.hover.value = hovered === card.id ? 1 : 0;
            slot.mesh.visible = true;
        }
        this.slots.forEach((slot) => {
            if (!used.has(slot)) slot.mesh.visible = false;
        });
        this.trimTextures();
    }

    private trimTextures() {
        // Retain a small LRU cache, never evicting a texture on a visible mesh.
        const active = new Set(
            this.slots
                .filter((slot) => slot.mesh.visible)
                .map((slot) => slot.url)
        );
        for (const [url, texture] of this.textures) {
            if (this.textures.size <= 36) break;
            if (!active.has(url)) {
                this.textures.delete(url);
                texture.dispose();
                this.slots.forEach((slot) => {
                    if (!slot.mesh.visible && slot.url === url) {
                        slot.key = slot.cardId = slot.url = "";
                        slot.mesh.material.uniforms.ready.value = 0;
                        slot.mesh.material.uniforms.map.value = null;
                    }
                });
            }
        }
    }

    private assignTexture(slot: Slot, card: LandingCard) {
        const key = slot.key;
        const sources = coverSources(card);
        let source = 0;
        const current = () => !this.disposed && slot.key === key;
        const apply = (url: string, texture: Texture) => {
            if (!current()) return;
            slot.url = url;
            const uniforms = slot.mesh.material.uniforms;
            uniforms.map.value = texture;
            uniforms.imageAspect.value =
                texture.image.width / texture.image.height;
            uniforms.ready.value = 1;
            this.invalidate();
        };
        const next = () => {
            if (!current()) return;
            while (source < sources.length) {
                const url = sources[source++];
                const cached = this.textures.get(url);
                if (cached) {
                    this.textures.delete(url);
                    this.textures.set(url, cached);
                    // Reappearing search results are ready in this frame, without a blank await.
                    apply(url, cached);
                    return;
                }
                if (this.failed.has(url)) continue;
                void this.loadTexture(url).then((texture) => {
                    if (current()) {
                        if (texture) apply(url, texture);
                        else next();
                    }
                    this.trimTextures();
                });
                return;
            }
            this.invalidate();
        };
        if (card.collage?.length >= 2) {
            const url = `collage:${card.collage.join("|")}`;
            void this.loadCollage(url, card.collage).then((texture) => {
                if (!current()) return;
                if (texture) apply(url, texture);
                else next();
                this.trimTextures();
            });
            return;
        }
        next();
    }

    /** Several covers on one texture, as leaning strips with a white rule. */
    private loadCollage(key: string, urls: string[]): Promise<Texture | null> {
        const cached = this.textures.get(key);
        if (cached) {
            this.textures.delete(key);
            this.textures.set(key, cached);
            return Promise.resolve(cached);
        }
        if (this.failed.has(key) || this.disposed) return Promise.resolve(null);
        if (this.pending.has(key)) return this.pending.get(key);
        const load = (url: string) =>
            new Promise<HTMLImageElement | null>((resolve) => {
                const image = new Image();
                image.crossOrigin = "anonymous";
                image.decoding = "async";
                image.onload = () => resolve(image);
                image.onerror = () => resolve(null);
                image.src = url;
            });
        const promise = Promise.all(urls.map(load)).then((loaded) => {
            this.pending.delete(key);
            if (this.disposed) return null;
            this.onLoading(this.pending.size > 0);
            const images = loaded.filter(Boolean);
            const canvas = document.createElement("canvas");
            canvas.width = 1280;
            canvas.height = 800;
            const context = images.length >= 2 && canvas.getContext("2d");
            if (!context) {
                this.failed.add(key);
                return null;
            }
            const strips = collageStrips(
                images.length,
                canvas.width,
                canvas.height
            );
            strips.forEach((strip, index) => {
                const image = images[index];
                context.save();
                context.beginPath();
                strip.corners.forEach(([x, y], corner) =>
                    corner ? context.lineTo(x, y) : context.moveTo(x, y)
                );
                context.closePath();
                context.clip();
                const fit = coverFit(
                    image.naturalWidth,
                    image.naturalHeight,
                    strip.box
                );
                context.drawImage(image, fit.x, fit.y, fit.width, fit.height);
                context.restore();
            });
            context.strokeStyle = "#fff";
            context.lineWidth = 6;
            strips.slice(1).forEach(({ corners: [top, , , bottom] }) => {
                context.beginPath();
                context.moveTo(top[0], top[1]);
                context.lineTo(bottom[0], bottom[1]);
                context.stroke();
            });
            const texture = configureCardTexture(new CanvasTexture(canvas));
            this.textures.set(key, texture);
            return texture;
        });
        this.pending.set(key, promise);
        this.onLoading(true);
        return promise;
    }

    private loadTexture(url: string): Promise<Texture | null> {
        const cached = this.textures.get(url);
        if (cached) {
            this.textures.delete(url);
            this.textures.set(url, cached);
            return Promise.resolve(cached);
        }
        if (this.failed.has(url) || this.disposed) return Promise.resolve(null);
        if (this.pending.has(url)) return this.pending.get(url);
        const promise = new Promise<Texture | null>((resolve) => {
            const done = (texture: Texture | null) => {
                this.pending.delete(url);
                if (!this.disposed) this.onLoading(this.pending.size > 0);
                if (!texture) {
                    this.failed.add(url);
                    resolve(null);
                    return;
                }
                if (this.disposed) {
                    texture.dispose();
                    resolve(null);
                    return;
                }
                configureCardTexture(texture);
                this.textures.set(url, texture);
                resolve(texture);
            };
            const viaImage = () =>
                this.loader.load(url, done, undefined, () => done(null));
            if (!this.bitmaps) {
                viaImage();
                return;
            }
            this.bitmaps.load(
                url,
                (bitmap) => {
                    const texture = new Texture(bitmap as any);
                    // Already flipped during decode.
                    texture.flipY = false;
                    texture.addEventListener("dispose", () =>
                        (bitmap as ImageBitmap).close?.()
                    );
                    done(texture);
                },
                undefined,
                // fetch() needs CORS where <img> may not: retry the old way.
                viaImage
            );
        });
        this.pending.set(url, promise);
        this.onLoading(true);
        return promise;
    }

    dispose() {
        this.disposed = true;
        this.onLoading(false);
        this.slots.forEach((slot) => slot.mesh.material.dispose());
        this.geometry.dispose();
        this.textures.forEach((texture) => texture.dispose());
        this.textures.clear();
    }
}
