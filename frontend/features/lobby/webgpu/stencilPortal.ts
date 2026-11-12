import * as THREE from "three/webgpu";
import {
    abs,
    asin,
    atan,
    cameraPosition,
    clamp,
    cos,
    exp,
    float as tslFloat,
    floor,
    fract,
    Fn,
    length,
    max,
    min,
    mix,
    normalize,
    positionWorld,
    pow,
    sin,
    smoothstep,
    texture,
    uniform,
    uv,
    vec2,
    vec3,
    vec4,
    dot,
    select,
    instanceIndex,
    positionGeometry,
    hash,
} from "three/tsl";

/**
 * The round "stencil" portal from the Oct 2026 profile portals, ported from
 * GLSL to TSL so it runs on the WebGPU lobby (and its WebGL2 fallback).
 *
 * - A wavy, slowly breathing aperture (the shared portal boundary) cuts a
 *   window into the lobby. Inside it the destination's 360 capture is sampled
 *   along the view ray, so it reads as a room behind the doorway, not a
 *   picture on a disc. Without a 360, the cover image fills the opening.
 * - An additive energy fringe of warped filaments, lace and a tinted haze
 *   hugs that same boundary.
 *
 * Once admitted, the same depth-tested boundary clears the lobby canvas alpha.
 * The destination's native renderer draws directly underneath, synchronously
 * using the mapped lobby camera. No capture, texture copy or flattened room.
 */

export const STENCIL_PORTAL_RADIUS = 2.45;
/** Aperture centre height; its lower lip stays just above the floor. */
export const STENCIL_PORTAL_HEIGHT = 2.46;
const BOUNDARY_EXTENT = 1.1;
const PI = Math.PI;

const portalHash = Fn(([p]: [any]) =>
    fract(sin(dot(p, vec2(127.1, 311.7))).mul(43758.5453))
);

const portalNoise = Fn(([p]: [any]) => {
    const i = floor(p);
    const f0 = fract(p);
    const f = f0.mul(f0).mul(tslFloat(3).sub(f0.mul(2)));
    const a = portalHash(i);
    const b = portalHash(i.add(vec2(1, 0)));
    const c = portalHash(i.add(vec2(0, 1)));
    const d = portalHash(i.add(vec2(1, 1)));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
});

/** Polar outline (radius 0.89 ± waves) shared by mask and fringe. */
const portalBoundary = Fn(([angle, t]: [any, any]) => {
    const p = vec2(cos(angle), sin(angle));
    const weight = smoothstep(-0.85, -0.25, p.y);
    const broad = tslFloat(0.1)
        .mul(
            sin(
                angle
                    .mul(2)
                    .add(sin(t.mul(0.29)).mul(0.45))
                    .add(0.6)
            )
        )
        .add(tslFloat(0.065).mul(sin(angle.mul(3).sub(t.mul(0.23)).add(1.4))))
        .add(tslFloat(0.025).mul(sin(angle.mul(5).add(t.mul(0.31)).sub(0.8))))
        .sub(0.015);
    const fine = portalNoise(p.mul(4).add(t.mul(0.19)))
        .sub(0.5)
        .mul(0.056)
        .add(
            portalNoise(p.mul(13).sub(t.mul(0.37)))
                .sub(0.5)
                .mul(0.022)
        )
        .add(
            portalNoise(p.mul(37).add(t.mul(0.62)))
                .sub(0.5)
                .mul(0.008)
        );
    // Kept mostly round: the bulges and grain are a gentle wobble.
    return tslFloat(0.89).add(weight.mul(broad).mul(0.08)).add(fine.mul(0.18));
});

const portalTint = Fn(([angle, t]: [any, any]) => {
    const hue = tslFloat(0.5).add(sin(angle.mul(2).add(t.mul(0.24))).mul(0.5));
    return mix(vec3(0.38, 0.7, 1.0), vec3(1.0, 0.38, 0.74), hue).add(
        vec3(0.3, 0.24, 0.08).mul(
            tslFloat(0.5).add(sin(angle.mul(5).sub(t.mul(0.3))).mul(0.5))
        )
    );
});

export interface StencilPortalDestination {
    imageUrl?: string;
    panoramaUrl?: string;
}

/** Radius of the unit boundary in metres, and the floor fold geometry. */
const BASE_RADIUS = STENCIL_PORTAL_RADIUS / 0.89;
const SPARKS = 720;

/** Match the native portal's saved-360 distance compensation. */
export function stencilPortalCaptureScale(distance: number): number {
    if (distance >= 10) return 5;
    if (!(distance > 3)) return 1;
    const t = (distance - 3) / 7;
    return 1 + 4 * t * t * (3 - 2 * t);
}

/**
 * The broken white core, coloured fringe and wispy haze around a boundary.
 * `d` is the signed distance to the outline, `width` the band width, `p`
 * the noise domain and `ring` the unit direction around the doorway.
 */
function energyField(
    d: any,
    width: any,
    p: any,
    ring: any,
    angle: any,
    time: any
) {
    const edge = abs(d).div(width);
    const turbulence = portalNoise(
        p.mul(29).add(vec2(time.mul(0.65), time.mul(-1.3)))
    );
    const wisps = portalNoise(ring.mul(62).add(d.mul(35)).sub(time.mul(1.8)));
    const clumps = portalNoise(ring.mul(8).add(time.mul(0.31)));
    const hot = tslFloat(0.55).add(clumps.mul(0.8));
    const filamentA = exp(
        abs(d.add(turbulence.sub(0.5).mul(0.018).mul(width)))
            .mul(-390)
            .div(width)
    );
    const filamentB = exp(
        abs(d.sub(wisps.sub(0.25).mul(0.048).mul(width)))
            .mul(-180)
            .div(width)
    );
    const lace = pow(max(tslFloat(1).sub(abs(wisps.sub(0.5)).mul(2)), 0), 9);
    const fringeGlow = exp(edge.mul(-30)).mul(
        tslFloat(0.25).add(lace.mul(1.8)).add(turbulence.mul(0.4))
    );
    const haze = exp(edge.mul(-15)).mul(tslFloat(0.25).add(clumps.mul(0.75)));
    const outer = smoothstep(-0.045, 0.035, d);
    const tint = portalTint(angle, time);
    const color = vec3(1.0, 0.91, 0.69)
        .mul(filamentA.mul(1.9).add(filamentB.mul(0.55)))
        .mul(hot)
        .add(tint.mul(fringeGlow).mul(0.65))
        .add(tint.mul(haze).mul(outer).mul(0.18));
    const energy = max(color.r, max(color.g, color.b));
    // Falloff lives in alpha so faint emissive RGB never shows a cut edge.
    const feather = tslFloat(1).sub(smoothstep(0.17, 0.28, edge));
    return {
        color: color.div(max(energy, 0.001)),
        alpha: min(energy, 1).mul(feather),
        edge,
    };
}

export function createStencilPortal() {
    const group = new THREE.Group();
    group.name = "lobby-stencil-portal";
    group.visible = false;

    const time = uniform(0);
    const opening = uniform(0);
    const opacity = uniform(0);
    const heading = uniform(0);
    const captureScale = uniform(1);
    const center = uniform(new THREE.Vector3());
    const normal = uniform(new THREE.Vector3(0, 0, 1));
    const mode = uniform(0); // 0 fallback, 1 cover image, 2 panorama
    const blank = new THREE.DataTexture(
        new Uint8Array([20, 26, 34, 255]),
        1,
        1
    );
    blank.needsUpdate = true;
    const coverCrop = uniform(new THREE.Vector4(1, 1, 0, 0));
    // Each sample() makes its own texture node with its own value, so keep
    // every one we create and point them all at the loaded image.
    const coverSamples: any[] = [];
    const panoramaSamples: any[] = [];
    const setSamples = (nodes: any[], map: THREE.Texture) => {
        for (const node of nodes) node.value = map;
        // Rebind the new image (a different texture object) on next draw.
        for (const material of contentMaterials) material.needsUpdate = true;
    };
    const contentMaterials: THREE.Material[] = [];

    /** The saved 360 is photographed inside the room while we stand outside
     * it: sample on the fixed doorway plane, widened with distance, so the
     * opening animation can't zoom the view. */
    const captureRay = () => {
        const ray = positionWorld.sub(cameraPosition);
        const rayLength = length(ray);
        const denominator = dot(ray, normal).div(max(rayLength, 0.00001));
        const distance = dot(center.sub(cameraPosition), normal).div(
            select(
                abs(denominator).lessThan(0.00001),
                tslFloat(0.00001),
                denominator
            )
        );
        const hit = cameraPosition.add(
            ray.mul(distance.div(max(rayLength, 0.00001)))
        );
        const widened = center
            .add(hit.sub(center).mul(captureScale))
            .sub(cameraPosition);
        const usable = captureScale
            .greaterThan(1)
            .and(abs(denominator).greaterThan(0.00001))
            .and(distance.greaterThan(0.00001));
        return normalize(select(usable, widened, ray));
    };

    /** What you see through the opening: 360, cover, or a dusk fallback. */
    const destinationColor = (coverUv: any) => {
        const ray = captureRay();
        const panoU = fract(
            atan(ray.z, ray.x)
                .div(2 * PI)
                .add(0.5)
                .add(heading.div(2 * PI))
        );
        const panoV = asin(clamp(ray.y, -1, 1)).div(PI).add(0.5);
        const sky = mix(
            vec3(0.016, 0.022, 0.032),
            vec3(0.13, 0.19, 0.23),
            pow(max(ray.y, 0), 0.6)
        );
        const panoramaNode = texture(blank, vec2(panoU, panoV));
        panoramaSamples.push(panoramaNode);
        const fromPanorama = panoramaNode.rgb;
        const coverNode = texture(
            blank,
            coverUv.mul(coverCrop.xy).add(coverCrop.zw)
        );
        coverSamples.push(coverNode);
        const fromCover = coverNode.rgb;
        return select(
            mode.greaterThan(1.5),
            fromPanorama,
            select(mode.greaterThan(0.5), fromCover, sky)
        );
    };

    // Aperture: the window into the destination.
    const size = (STENCIL_PORTAL_RADIUS * 2 * BOUNDARY_EXTENT) / 0.89;
    const apertureGeometry = new THREE.PlaneGeometry(size, size);
    const aperture = new THREE.MeshBasicNodeMaterial({
        side: THREE.DoubleSide,
        transparent: true,
        depthWrite: true,
    });
    aperture.toneMapped = false;
    aperture.fog = false;
    const p = uv()
        .sub(0.5)
        .mul(2 * BOUNDARY_EXTENT);
    const angle = atan(p.y, p.x);
    const edge = portalBoundary(angle, time).mul(opening).sub(length(p));
    const innerGlow = vec3(0.48, 0.62, 0.7).mul(exp(edge.mul(-60)).mul(0.35));
    aperture.colorNode = vec4(destinationColor(uv()).add(innerGlow), 1);
    // Below the floor the fold takes over, so the doorway never pokes through.
    aperture.opacityNode = select(
        edge.lessThan(0).or(positionWorld.y.lessThan(0.004)),
        tslFloat(0),
        opacity
    );
    aperture.alphaTest = 0.01;
    contentMaterials.push(aperture);
    const apertureMesh = new THREE.Mesh(apertureGeometry, aperture);
    apertureMesh.name = "lobby-stencil-portal-aperture";
    apertureMesh.renderOrder = 3;

    // Energy fringe around the same boundary.
    const fringeSize = (STENCIL_PORTAL_RADIUS * 2 * 1.4) / 0.89;
    const fringeGeometry = new THREE.PlaneGeometry(fringeSize, fringeSize);
    const fringe = new THREE.MeshBasicNodeMaterial({
        side: THREE.DoubleSide,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
    });
    fringe.toneMapped = false;
    fringe.fog = false;
    const fp = uv().sub(0.5).mul(2.8);
    const fa = atan(fp.y, fp.x);
    const fd = length(fp).sub(portalBoundary(fa, time).mul(opening));
    // Narrow the band with the opening, so the orb grows into a tear.
    const rim = energyField(
        fd,
        max(tslFloat(0.12), opening),
        fp,
        normalize(fp.add(0.0001)),
        fa,
        time
    );
    fringe.colorNode = vec4(rim.color, 1);
    fringe.opacityNode = select(
        rim.edge.greaterThan(0.29).or(positionWorld.y.lessThan(0.004)),
        tslFloat(0),
        opacity.mul(opening).mul(rim.alpha)
    );
    const fringeMesh = new THREE.Mesh(fringeGeometry, fringe);
    fringeMesh.name = "lobby-stencil-portal-fringe";
    fringeMesh.renderOrder = 4;
    fringeMesh.position.z = 0.003;

    // Drifting sparks: GPU-only motion from stable per-instance seeds.
    const seed = vec3(
        hash(instanceIndex),
        hash(instanceIndex.add(7919)),
        hash(instanceIndex.add(104729))
    );
    const life = fract(seed.y.add(time.mul(seed.z.mul(0.36).add(0.28))));
    const sparkAngle = seed.x
        .mul(2 * PI)
        .add(life.mul(seed.z.sub(0.5)).mul(0.22));
    const sparkRing = vec2(cos(sparkAngle), sin(sparkAngle));
    const sparkRadius = portalBoundary(sparkAngle, time)
        .mul(BASE_RADIUS)
        .mul(opening)
        .add(pow(life, 1.65).mul(seed.z.mul(seed.z).mul(0.16).add(0.04)));
    const sparkPosition = vec3(
        sparkRing.x.mul(sparkRadius),
        sparkRing.y.mul(sparkRadius).sub(life.mul(life).mul(0.05)),
        seed.z.sub(0.5).mul(life.mul(0.18).add(0.05))
    );
    const sparkMaterial = new THREE.PointsNodeMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        sizeAttenuation: true,
    });
    sparkMaterial.toneMapped = false;
    sparkMaterial.fog = false;
    sparkMaterial.positionNode = sparkPosition;
    // Pixels at 1 m: matches the original gl_PointSize falloff.
    sparkMaterial.sizeNode = tslFloat(0.012)
        .add(pow(seed.z, 4).mul(0.032))
        .mul(2.2);
    const sparkUv = uv().sub(0.5).mul(2);
    const sparkR = length(sparkUv);
    const core = exp(sparkR.mul(sparkR).mul(-10));
    const glow = tslFloat(1).sub(smoothstep(0.15, 1, sparkR)).mul(0.35);
    const cluster = portalNoise(sparkRing.mul(9).add(time.mul(0.3)));
    sparkMaterial.colorNode = vec4(
        mix(portalTint(sparkAngle, time), vec3(1.0, 0.97, 0.85), 0.75).mul(
            core.add(1.4)
        ),
        1
    );
    sparkMaterial.opacityNode = select(
        sparkR.greaterThan(1),
        tslFloat(0),
        core
            .add(glow)
            .mul(sin(life.mul(PI)))
            .mul(cluster.mul(0.7).add(0.3))
            .mul(opacity)
            .mul(opening)
    );
    const sparks = new THREE.Sprite(sparkMaterial);
    sparks.count = SPARKS;
    sparks.name = "lobby-stencil-portal-sparks";
    sparks.renderOrder = 5;

    group.add(apertureMesh, fringeMesh, sparks);
    group.traverse((object) => (object.frustumCulled = false));

    let loaded: THREE.Texture | undefined;
    let request = 0;
    const loader = new THREE.TextureLoader().setCrossOrigin("anonymous");

    function setDestination(destination?: StencilPortalDestination) {
        const id = ++request;
        loaded?.dispose();
        loaded = undefined;
        setSamples(coverSamples, blank);
        setSamples(panoramaSamples, blank);
        mode.value = 0;
        const url = destination?.panoramaUrl || destination?.imageUrl;
        if (!url) return;
        const isPanorama = !!destination?.panoramaUrl;
        if (process.env.NODE_ENV === "development")
            console.info(
                "[lobby-portal] loading",
                isPanorama ? "360" : "cover",
                url
            );
        loader.load(
            url,
            (map) => {
                if (id !== request) {
                    map.dispose();
                    return;
                }
                map.colorSpace = THREE.SRGBColorSpace;
                if (isPanorama) {
                    map.wrapS = THREE.RepeatWrapping;
                    setSamples(panoramaSamples, map);
                    mode.value = 2;
                } else {
                    const image = map.image as {
                        width?: number;
                        height?: number;
                    };
                    const aspect =
                        image?.width && image?.height
                            ? image.width / image.height
                            : 1;
                    if (aspect > 1)
                        coverCrop.value.set(
                            1 / aspect,
                            1,
                            (1 - 1 / aspect) / 2,
                            0
                        );
                    else coverCrop.value.set(1, aspect, 0, (1 - aspect) / 2);
                    setSamples(coverSamples, map);
                    mode.value = 1;
                }
                loaded = map;
                if (process.env.NODE_ENV === "development")
                    console.info(
                        "[lobby-portal] loaded",
                        isPanorama ? "360" : "cover"
                    );
            },
            undefined,
            (error) => {
                if (process.env.NODE_ENV === "development")
                    console.warn("[lobby-portal] failed", url, String(error));
            }
        );
    }

    let live = false;
    const setLive = (enabled: boolean) => {
        if (live === enabled) return;
        live = enabled;
        for (const material of contentMaterials) {
            material.blending = enabled
                ? THREE.CustomBlending
                : THREE.NormalBlending;
            material.blendSrc = THREE.ZeroFactor;
            material.blendDst = THREE.ZeroFactor;
            material.blendSrcAlpha = THREE.ZeroFactor;
            material.blendDstAlpha = THREE.OneMinusSrcAlphaFactor;
            material.blendEquation = THREE.AddEquation;
            material.blendEquationAlpha = THREE.AddEquation;
            material.needsUpdate = true;
        }
    };

    const worldCenter = new THREE.Vector3();
    const worldNormal = new THREE.Vector3();
    const worldQuaternion = new THREE.Quaternion();

    return {
        group,
        aperture: apertureMesh,
        setDestination,
        setLive,
        update(frame: {
            time: number;
            opening: number;
            opacity: number;
            heading?: number;
            camera?: { position: { x: number; y: number; z: number } };
        }) {
            time.value = frame.time;
            opening.value = frame.opening;
            opacity.value = frame.opacity;
            group.updateWorldMatrix(true, false);
            group.getWorldPosition(worldCenter);
            group.getWorldQuaternion(worldQuaternion);
            worldNormal.set(0, 0, 1).applyQuaternion(worldQuaternion);
            center.value.copy(worldCenter);
            normal.value.copy(worldNormal);
            // Align the 360's forward with the doorway's facing.
            heading.value =
                frame.heading ?? Math.atan2(worldNormal.x, worldNormal.z);
            captureScale.value = frame.camera
                ? stencilPortalCaptureScale(
                      Math.hypot(
                          frame.camera.position.x - worldCenter.x,
                          frame.camera.position.y - worldCenter.y,
                          frame.camera.position.z - worldCenter.z
                      )
                  )
                : 1;
        },
        dispose() {
            request++;
            group.removeFromParent();
            loaded?.dispose();
            blank.dispose();
            apertureGeometry.dispose();
            aperture.dispose();
            fringeGeometry.dispose();
            fringe.dispose();

            sparkMaterial.dispose();
        },
    };
}

export type StencilPortal = ReturnType<typeof createStencilPortal>;
