import CameraControls from "camera-controls";
import * as THREEVanilla from "three";
import { sampleChordalSpline } from "../guide/spline";
import {
    ACESFilmicToneMapping,
    Box3,
    BoxGeometry,
    BufferGeometry,
    CanvasTexture,
    CatmullRomCurve3,
    Color,
    CylinderGeometry,
    DirectionalLight,
    DoubleSide,
    EdgesGeometry,
    FogExp2,
    Group,
    HemisphereLight,
    Line,
    LineBasicMaterial,
    LineSegments,
    MathUtils,
    Mesh,
    MeshBasicMaterial,
    MeshStandardMaterial,
    PCFSoftShadowMap,
    PerspectiveCamera,
    Plane,
    PlaneGeometry,
    Raycaster,
    Scene,
    SphereGeometry,
    SRGBColorSpace,
    TorusGeometry,
    TextureLoader,
    Vector2,
    Vector3,
    WebGLRenderer,
} from "three";

CameraControls.install({ THREE: THREEVanilla as any });

export type Vec3 = [number, number, number];
export type PathKind = "position" | "target";
export type ViewMode = "edit" | "camera";
export type NavigationMode = "perspective" | "map";

export interface VideoSetNode {
    id: string;
    kind: "box" | "cylinder" | "sphere" | "torus" | "plane";
    size: number[];
    position: Vec3;
    rotation?: Vec3;
    color?: string;
    roughness?: number;
    metalness?: number;
    opacity?: number;
    emissive?: string;
    emissiveIntensity?: number;
    castShadow?: boolean;
    receiveShadow?: boolean;
}

export interface VideoSetDefinition {
    id: string;
    palette: {
        sky: string;
        fog?: string;
        light?: string;
        lightIntensity?: number;
    };
    nodes: VideoSetNode[];
}

export interface VideoCameraTrack {
    position: { points: Vec3[] };
    target: { points: Vec3[] };
    focalLengthMm: number;
    rollDeg: number;
}

export interface VideoEngineShot {
    id: string;
    camera: VideoCameraTrack;
}

export interface VideoEngineArtwork {
    id: string;
    title: string;
    position: Vec3;
    rotation: Vec3;
    width: number;
    height: number;
    accent?: string;
    imageUrl?: string;
    protection: "generative" | "identity" | "exact";
}

export interface VideoEngineCallbacks {
    onPathPointPreview?: (kind: PathKind, index: number, value: Vec3) => void;
    onPathPointCommit?: (kind: PathKind, index: number, value: Vec3) => void;
    onPathPointSelect?: (kind: PathKind, index: number) => void;
    onSelectArtwork?: (id: string) => void;
}

export interface CameraSample {
    cameraWorldMatrix: number[];
    projectionMatrix: number[];
}

export interface VideoEngine {
    loadSet(set: VideoSetDefinition): void;
    setShot(shot: VideoEngineShot): void;
    setArtworks(artworks: VideoEngineArtwork[]): void;
    updateArtwork(artwork: VideoEngineArtwork): void;
    setMode(mode: ViewMode): void;
    setNavigationMode(mode: NavigationMode): void;
    setPathKind(kind: PathKind): void;
    setActivePathPoint(index: number): void;
    seek(normalizedTime: number): void;
    cameraSample(): CameraSample;
    capturePoster(): string;
    resize(): void;
    dispose(): void;
}

const UP = new Vector3(0, 1, 0);
const BASE_DAMPING = 0.05;
// Keep click-to-walk at the same eye height as the canonical Studio editor.
const USER_HEIGHT = 2.8;
const PERSPECTIVE_SPEED = 4.5;
const MAP_SPEED = 45;
const MOVE_KEYS = new Set([
    "KeyW",
    "KeyA",
    "KeyS",
    "KeyD",
    "ArrowUp",
    "ArrowDown",
    "ArrowLeft",
    "ArrowRight",
    "Space",
    "KeyB",
]);

function isTextControl(target: EventTarget | null) {
    if (!(target instanceof HTMLElement)) return false;
    return (
        target.isContentEditable ||
        target.matches("input, textarea, select, [role='textbox']")
    );
}

function geometryFor(node: VideoSetNode) {
    const size = node.size;
    switch (node.kind) {
        case "cylinder":
            return new CylinderGeometry(
                size[0],
                size[1] ?? size[0],
                size[2] ?? 1,
                32
            );
        case "sphere":
            return new SphereGeometry(size[0], 32, 20);
        case "torus":
            return new TorusGeometry(size[0], size[1] ?? 0.1, 18, 72);
        case "plane":
            return new PlaneGeometry(size[0], size[1]);
        case "box":
        default:
            return new BoxGeometry(size[0], size[1], size[2]);
    }
}

function materialFor(node: VideoSetNode) {
    const options: ConstructorParameters<typeof MeshStandardMaterial>[0] = {
        color: node.color || "#b9b7ae",
        roughness: node.roughness ?? 0.72,
        metalness: node.metalness ?? 0.04,
        transparent: node.opacity !== undefined,
        opacity: node.opacity ?? 1,
        depthWrite: node.opacity === undefined || node.opacity > 0.85,
        emissive: node.emissive || "#000000",
        emissiveIntensity: node.emissiveIntensity ?? 0,
    };
    if (node.kind === "plane") options.side = DoubleSide;
    return new MeshStandardMaterial(options);
}

function disposeTree(root: Group | Scene) {
    root.traverse((object: any) => {
        object.geometry?.dispose?.();
        const materials = Array.isArray(object.material)
            ? object.material
            : object.material
            ? [object.material]
            : [];
        for (const material of materials) {
            for (const value of Object.values(material) as any[]) {
                if (value?.isTexture) value.dispose();
            }
            material.dispose?.();
        }
    });
}

function artworkTexture(title: string, accent: string) {
    const canvas = document.createElement("canvas");
    canvas.width = 800;
    canvas.height = 1000;
    const context = canvas.getContext("2d")!;
    const gradient = context.createLinearGradient(0, 0, 800, 1000);
    gradient.addColorStop(0, "#090a0a");
    gradient.addColorStop(0.5, accent);
    gradient.addColorStop(1, "#020202");
    context.fillStyle = gradient;
    context.fillRect(0, 0, 800, 1000);
    context.globalCompositeOperation = "screen";
    for (let index = 0; index < 11; index += 1) {
        context.strokeStyle = `rgba(255,255,255,${0.045 + index * 0.014})`;
        context.lineWidth = 2 + index * 0.8;
        context.beginPath();
        context.arc(
            400,
            430,
            72 + index * 29,
            index * 0.31,
            Math.PI * 1.25 + index * 0.21
        );
        context.stroke();
    }
    context.globalCompositeOperation = "source-over";
    context.fillStyle = "rgba(255,255,255,.92)";
    context.font = "500 34px sans-serif";
    context.fillText(title.toUpperCase(), 48, 900);
    context.fillStyle = "rgba(255,255,255,.52)";
    context.font = "400 15px monospace";
    context.fillText("EXACT SOURCE PLATE", 50, 938);
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    texture.anisotropy = 8;
    return texture;
}

export function createVideoEngine(
    canvas: HTMLCanvasElement,
    callbacks: VideoEngineCallbacks = {}
): VideoEngine {
    const scene = new Scene();
    scene.background = new Color("#101111");
    scene.fog = new FogExp2("#101111", 0.018);

    const renderer = new WebGLRenderer({
        canvas,
        antialias: true,
        preserveDrawingBuffer: true,
        powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = SRGBColorSpace;
    renderer.toneMapping = ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = PCFSoftShadowMap;

    const editorCamera = new PerspectiveCamera(42, 1, 0.05, 400);
    editorCamera.position.set(11, 8.5, 13);
    editorCamera.lookAt(0, 2, 0);
    const shotCamera = new PerspectiveCamera(48, 1, 0.05, 400);
    const controls = new CameraControls(editorCamera as any, canvas);
    controls.dampingFactor = BASE_DAMPING;
    controls.draggingDampingFactor = 0.25;
    controls.azimuthRotateSpeed = -0.5;
    controls.polarRotateSpeed = -0.1;
    controls.dollyToCursor = false;
    controls.minDistance = 0.15;
    controls.maxDistance = 180;
    controls.setLookAt(11, 8.5, 13, 0, 2.2, 0, false);
    controls.saveState();

    const stageRoot = new Group();
    const artworkRoot = new Group();
    const pathRoot = new Group();
    scene.add(stageRoot, artworkRoot, pathRoot);

    scene.add(new HemisphereLight("#f5eee0", "#15191d", 1.8));
    const keyLight = new DirectionalLight("#fff4dd", 4.5);
    keyLight.position.set(8, 13, 7);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(2048, 2048);
    keyLight.shadow.camera.left = -18;
    keyLight.shadow.camera.right = 18;
    keyLight.shadow.camera.top = 18;
    keyLight.shadow.camera.bottom = -18;
    scene.add(keyLight);

    let mode: ViewMode = "edit";
    let navigationMode: NavigationMode = "perspective";
    let pathKind: PathKind = "position";
    let activePathPointIndex = 0;
    let normalizedTime = 0;
    let shot: VideoEngineShot | null = null;
    let handleTargets: Mesh[] = [];
    let artworkMeshes: Mesh[] = [];
    let frame = 0;
    let previousFrame = performance.now();
    const keyStates = new Set<string>();
    const savedPerspective = {
        position: new Vector3(),
        target: new Vector3(),
        available: false,
    };
    let navigationTransition = 0;
    let pathLine: Line | null = null;
    let pointerGesture: {
        pointerId: number;
        x: number;
        y: number;
        moved: boolean;
    } | null = null;

    const raycaster = new Raycaster();
    const pointer = new Vector2();
    const dragPlane = new Plane(UP, 0);
    const shotTarget = new Vector3();
    let drag: {
        pointerId: number;
        kind: PathKind;
        index: number;
        handle: Mesh;
        start: Vec3;
    } | null = null;

    function updateNavigationBindings() {
        const action = CameraControls.ACTION;
        controls.mouseButtons.left =
            navigationMode === "map" ? action.TRUCK : action.ROTATE;
        controls.mouseButtons.shiftLeft =
            navigationMode === "map" ? action.ROTATE : action.TRUCK;
        controls.mouseButtons.right = action.ROTATE;
        controls.mouseButtons.middle = action.ROTATE;
        controls.mouseButtons.wheel = action.DOLLY;
        controls.touches.one =
            navigationMode === "map" ? action.TOUCH_TRUCK : action.TOUCH_ROTATE;
        controls.touches.two = action.TOUCH_DOLLY_TRUCK;
    }

    updateNavigationBindings();

    function resize() {
        const rect = canvas.getBoundingClientRect();
        const width = Math.max(1, Math.round(rect.width));
        const height = Math.max(1, Math.round(rect.height));
        renderer.setSize(width, height, false);
        editorCamera.aspect = width / height;
        shotCamera.aspect = width / height;
        editorCamera.updateProjectionMatrix();
        shotCamera.updateProjectionMatrix();
    }

    function loadSet(set: VideoSetDefinition) {
        disposeTree(stageRoot);
        stageRoot.clear();
        scene.background = new Color(set.palette.sky);
        (scene.fog as FogExp2).color.set(set.palette.fog || set.palette.sky);
        keyLight.color.set(set.palette.light || "#fff4dd");
        keyLight.intensity = set.palette.lightIntensity ?? 4.5;
        for (const node of set.nodes) {
            const mesh = new Mesh(geometryFor(node), materialFor(node));
            mesh.name = node.id;
            mesh.position.fromArray(node.position);
            mesh.rotation.set(...(node.rotation || [0, 0, 0]));
            mesh.castShadow = node.castShadow ?? true;
            mesh.receiveShadow = node.receiveShadow ?? true;
            mesh.userData.videoWalkable = /floor|ground|platform/i.test(
                node.id
            );
            stageRoot.add(mesh);
        }
        stageRoot.updateMatrixWorld(true);
        if (navigationMode === "map") void setMapPose(false);
    }

    function setMapPose(transition: boolean) {
        const bounds = new Box3().setFromObject(stageRoot);
        const center = bounds.isEmpty()
            ? new Vector3(0, 0, 0)
            : bounds.getCenter(new Vector3());
        const size = bounds.isEmpty()
            ? new Vector3(10, 6, 10)
            : bounds.getSize(new Vector3());
        const radius = Math.max(size.length() * 0.5, 5);
        const verticalFov = MathUtils.degToRad(editorCamera.fov);
        const distance =
            (radius / Math.sin(Math.max(verticalFov * 0.5, 0.1))) * 1.12;
        const position = new Vector3(0.46, 1, 0.46)
            .normalize()
            .multiplyScalar(distance)
            .add(center);
        return controls.setLookAt(
            position.x,
            position.y,
            position.z,
            center.x,
            center.y,
            center.z,
            transition
        );
    }

    function curve(kind: PathKind) {
        const points = shot?.camera[kind].points.map(
            (point) => new Vector3(...point)
        );
        return points && points.length > 1
            ? new CatmullRomCurve3(points, false, "chordal", 0.5)
            : null;
    }

    function seek(value: number) {
        normalizedTime = MathUtils.clamp(value, 0, 1);
        if (!shot) return;
        shotCamera.position.fromArray(
            sampleChordalSpline(
                {
                    interpolation: "catmull-rom-chordal",
                    points: shot.camera.position.points,
                },
                normalizedTime
            )
        );
        shotCamera.lookAt(
            shotTarget.fromArray(
                sampleChordalSpline(
                    {
                        interpolation: "catmull-rom-chordal",
                        points: shot.camera.target.points,
                    },
                    normalizedTime
                )
            )
        );
        shotCamera.rotateZ(MathUtils.degToRad(shot.camera.rollDeg));
        shotCamera.setFocalLength(shot.camera.focalLengthMm);
        shotCamera.updateMatrixWorld(true);
    }

    function rebuildPath() {
        disposeTree(pathRoot);
        pathRoot.clear();
        handleTargets = [];
        pathLine = null;
        const activeCurve = curve(pathKind);
        if (!activeCurve || !shot) return;
        const color = pathKind === "position" ? "#d3ec42" : "#75e4ff";
        pathLine = new Line(
            new BufferGeometry().setFromPoints(activeCurve.getPoints(96)),
            new LineBasicMaterial({
                color,
                transparent: true,
                opacity: 0.92,
            })
        );
        pathRoot.add(pathLine);
        shot.camera[pathKind].points.forEach((point, index) => {
            const handle = new Mesh(
                new SphereGeometry(index === 0 ? 0.17 : 0.13, 18, 12),
                new MeshBasicMaterial({
                    color,
                    depthTest: false,
                    transparent: true,
                    opacity: index === activePathPointIndex ? 1 : 0.72,
                })
            );
            handle.position.fromArray(point);
            handle.renderOrder = 20;
            handle.userData.pathHandle = { kind: pathKind, index };
            pathRoot.add(handle);
            handleTargets.push(handle);
        });
        updatePathPointSelection();
    }

    function updatePathPointSelection() {
        handleTargets.forEach((handle, index) => {
            const selected = index === activePathPointIndex;
            handle.scale.setScalar(selected ? 1.34 : 1);
            const material = handle.material as MeshBasicMaterial;
            material.opacity = selected ? 1 : 0.72;
        });
    }

    function setActivePathPoint(index: number) {
        activePathPointIndex = Math.max(
            0,
            Math.min(handleTargets.length - 1, Math.round(index))
        );
        updatePathPointSelection();
    }

    function setShot(next: VideoEngineShot) {
        shot = {
            ...next,
            camera: {
                ...next.camera,
                position: {
                    points: next.camera.position.points.map(
                        (point) => [...point] as Vec3
                    ),
                },
                target: {
                    points: next.camera.target.points.map(
                        (point) => [...point] as Vec3
                    ),
                },
            },
        };
        rebuildPath();
        seek(normalizedTime);
    }

    function setArtworks(artworks: VideoEngineArtwork[]) {
        disposeTree(artworkRoot);
        artworkRoot.clear();
        artworkMeshes = artworks.map((artwork) => {
            const material = new MeshBasicMaterial({
                map: artworkTexture(artwork.title, artwork.accent || "#7654ff"),
                side: DoubleSide,
            });
            const mesh = new Mesh(
                new PlaneGeometry(artwork.width, artwork.height),
                material
            );
            mesh.position.fromArray(artwork.position);
            mesh.rotation.set(...artwork.rotation);
            mesh.userData.artworkId = artwork.id;
            mesh.userData.imageUrl = artwork.imageUrl;
            artworkRoot.add(mesh);
            if (artwork.imageUrl) {
                new TextureLoader().load(artwork.imageUrl, (texture) => {
                    if (
                        mesh.parent !== artworkRoot ||
                        mesh.userData.imageUrl !== artwork.imageUrl
                    ) {
                        texture.dispose();
                        return;
                    }
                    texture.colorSpace = SRGBColorSpace;
                    texture.anisotropy = 8;
                    material.map?.dispose();
                    material.map = texture;
                    material.needsUpdate = true;
                });
            }
            if (artwork.protection === "exact") {
                const frame = new LineSegments(
                    new EdgesGeometry(
                        new BoxGeometry(
                            artwork.width + 0.08,
                            artwork.height + 0.08,
                            0.06
                        )
                    ),
                    new LineBasicMaterial({
                        color: "#d3ec42",
                        transparent: true,
                        opacity: 0.8,
                    })
                );
                frame.position.copy(mesh.position);
                frame.rotation.copy(mesh.rotation);
                artworkRoot.add(frame);
            }
            return mesh;
        });
    }

    function updateArtwork(artwork: VideoEngineArtwork) {
        const mesh = artworkMeshes.find(
            (candidate) => candidate.userData.artworkId === artwork.id
        );
        if (!mesh) return;
        mesh.position.fromArray(artwork.position);
        mesh.rotation.set(...artwork.rotation);
    }

    function setMode(next: ViewMode) {
        mode = next;
        controls.enabled = mode === "edit";
        pathRoot.visible = mode === "edit";
        if (mode !== "edit") keyStates.clear();
    }

    function setNavigationMode(next: NavigationMode) {
        if (navigationMode === next) return;
        const transitionId = ++navigationTransition;
        if (next === "map") {
            controls.getPosition(savedPerspective.position as any);
            controls.getTarget(savedPerspective.target as any);
            savedPerspective.available = true;
        }
        navigationMode = next;
        updateNavigationBindings();
        controls.dampingFactor = 0.1;
        const transition =
            next === "map"
                ? setMapPose(true)
                : savedPerspective.available
                ? controls.setLookAt(
                      savedPerspective.position.x,
                      savedPerspective.position.y,
                      savedPerspective.position.z,
                      savedPerspective.target.x,
                      savedPerspective.target.y,
                      savedPerspective.target.z,
                      true
                  )
                : controls.reset(true).then(() => undefined);
        void transition.finally(() => {
            if (navigationTransition === transitionId) {
                controls.dampingFactor = BASE_DAMPING;
            }
        });
    }

    function setPathKind(next: PathKind) {
        pathKind = next;
        rebuildPath();
    }

    function setPointer(event: PointerEvent) {
        const rect = canvas.getBoundingClientRect();
        pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    }

    function onPointerDown(event: PointerEvent) {
        canvas.focus({ preventScroll: true });
        if (mode !== "edit") return;
        const primaryPointer = event.pointerType !== "touch" || event.isPrimary;
        if (event.button === 0 && primaryPointer && !pointerGesture) {
            pointerGesture = {
                pointerId: event.pointerId,
                x: event.clientX,
                y: event.clientY,
                moved: false,
            };
        } else if (event.pointerType === "touch") {
            pointerGesture = null;
        }
        if (event.button !== 0 || !primaryPointer || drag) return;
        setPointer(event);
        raycaster.setFromCamera(pointer, editorCamera);
        const handleHit = raycaster.intersectObjects(handleTargets, false)[0];
        if (handleHit) {
            event.preventDefault();
            event.stopImmediatePropagation();
            const handle = handleHit.object as Mesh;
            const selected = handle.userData.pathHandle as {
                kind: PathKind;
                index: number;
            };
            setActivePathPoint(selected.index);
            callbacks.onPathPointSelect?.(selected.kind, selected.index);
            drag = {
                pointerId: event.pointerId,
                ...selected,
                handle,
                start: handle.position.toArray() as Vec3,
            };
            dragPlane.set(UP, -handle.position.y);
            controls.enabled = false;
            canvas.setPointerCapture(event.pointerId);
            return;
        }
    }

    function onPointerMove(event: PointerEvent) {
        if (pointerGesture?.pointerId === event.pointerId) {
            pointerGesture.moved ||=
                Math.hypot(
                    event.clientX - pointerGesture.x,
                    event.clientY - pointerGesture.y
                ) > 4;
        }
        if (!drag || drag.pointerId !== event.pointerId) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        setPointer(event);
        raycaster.setFromCamera(pointer, editorCamera);
        const point = new Vector3();
        if (!raycaster.ray.intersectPlane(dragPlane, point)) return;
        point.x = Math.round(point.x * 20) / 20;
        point.z = Math.round(point.z * 20) / 20;
        drag.handle.position.copy(point);
        if (shot) {
            shot.camera[drag.kind].points[drag.index] = point.toArray() as Vec3;
            const activeCurve = curve(drag.kind);
            if (activeCurve && pathLine) {
                pathLine.geometry.dispose();
                pathLine.geometry = new BufferGeometry().setFromPoints(
                    activeCurve.getPoints(96)
                );
            }
            seek(normalizedTime);
        }
        callbacks.onPathPointPreview?.(
            drag.kind,
            drag.index,
            point.toArray() as Vec3
        );
    }

    function onPointerUp(event: PointerEvent) {
        const gesture =
            pointerGesture?.pointerId === event.pointerId
                ? pointerGesture
                : null;
        if (gesture) pointerGesture = null;
        if (drag && drag.pointerId === event.pointerId) {
            event.preventDefault();
            event.stopImmediatePropagation();
            const finished = drag;
            drag = null;
            controls.enabled = mode === "edit";
            const value = finished.handle.position.toArray() as Vec3;
            const moved = value.some(
                (part, index) => Math.abs(part - finished.start[index]) > 1e-6
            );
            if (moved)
                callbacks.onPathPointCommit?.(
                    finished.kind,
                    finished.index,
                    value
                );
            return;
        }
        if (!gesture || gesture.moved || mode !== "edit") return;
        setPointer(event);
        raycaster.setFromCamera(pointer, editorCamera);
        const artworkHit = raycaster.intersectObjects(artworkMeshes, false)[0];
        if (artworkHit) {
            callbacks.onSelectArtwork?.(artworkHit.object.userData.artworkId);
            return;
        }
        if (navigationMode !== "perspective") return;
        const floorHit = raycaster
            .intersectObjects(stageRoot.children, true)
            .find((hit) => hit.object.userData.videoWalkable);
        if (!floorHit) return;
        window.setTimeout(() => {
            void controls.dollyTo(0.00001, true);
            void controls.moveTo(
                floorHit.point.x,
                floorHit.point.y + USER_HEIGHT,
                floorHit.point.z,
                true
            );
        }, 0);
    }

    function onPointerCancel(event: PointerEvent) {
        if (pointerGesture?.pointerId === event.pointerId) {
            pointerGesture = null;
        }
        if (!drag || drag.pointerId !== event.pointerId) return;
        const cancelled = drag;
        drag = null;
        cancelled.handle.position.fromArray(cancelled.start);
        if (shot) {
            shot.camera[cancelled.kind].points[cancelled.index] = [
                ...cancelled.start,
            ] as Vec3;
            const activeCurve = curve(cancelled.kind);
            if (activeCurve && pathLine) {
                pathLine.geometry.dispose();
                pathLine.geometry = new BufferGeometry().setFromPoints(
                    activeCurve.getPoints(96)
                );
            }
            seek(normalizedTime);
        }
        callbacks.onPathPointPreview?.(cancelled.kind, cancelled.index, [
            ...cancelled.start,
        ] as Vec3);
        controls.enabled = mode === "edit";
    }

    function onKeyDown(event: KeyboardEvent) {
        if (
            mode !== "edit" ||
            event.ctrlKey ||
            event.metaKey ||
            event.altKey ||
            isTextControl(event.target) ||
            !MOVE_KEYS.has(event.code)
        )
            return;
        keyStates.add(event.code);
        event.stopPropagation();
        if (event.code.startsWith("Arrow") || event.code === "Space") {
            event.preventDefault();
        }
    }

    function onKeyUp(event: KeyboardEvent) {
        keyStates.delete(event.code);
    }

    function updateKeyboard(delta: number) {
        if (mode !== "edit" || !keyStates.size) return;
        const distance =
            (navigationMode === "map" ? MAP_SPEED : PERSPECTIVE_SPEED) * delta;
        if (keyStates.has("KeyW") || keyStates.has("ArrowUp")) {
            void controls.forward(distance, false);
        }
        if (keyStates.has("KeyS") || keyStates.has("ArrowDown")) {
            void controls.forward(-distance, false);
        }
        if (keyStates.has("KeyA") || keyStates.has("ArrowLeft")) {
            void controls.truck(-distance, 0, false);
        }
        if (keyStates.has("KeyD") || keyStates.has("ArrowRight")) {
            void controls.truck(distance, 0, false);
        }
        if (keyStates.has("Space")) {
            void controls.truck(0, -distance, false);
        }
        if (keyStates.has("KeyB")) {
            void controls.truck(0, distance, false);
        }
    }

    function cameraSample(): CameraSample {
        shotCamera.updateMatrixWorld(true);
        return {
            cameraWorldMatrix: shotCamera.matrixWorld.toArray(),
            projectionMatrix: shotCamera.projectionMatrix.toArray(),
        };
    }

    function render(now = performance.now()) {
        const delta = Math.min((now - previousFrame) / 1000, 0.05);
        previousFrame = now;
        updateKeyboard(delta);
        controls.update(delta);
        renderer.render(scene, mode === "camera" ? shotCamera : editorCamera);
        frame = requestAnimationFrame(render);
    }

    function capturePoster() {
        const size = renderer.getSize(new Vector2());
        const pixelRatio = renderer.getPixelRatio();
        const shotAspect = shotCamera.aspect;
        const pathVisible = pathRoot.visible;
        try {
            renderer.setPixelRatio(1);
            renderer.setSize(1280, 720, false);
            shotCamera.aspect = 16 / 9;
            shotCamera.updateProjectionMatrix();
            pathRoot.visible = false;
            renderer.render(scene, shotCamera);
            return canvas.toDataURL("image/webp", 0.82);
        } finally {
            renderer.setPixelRatio(pixelRatio);
            renderer.setSize(size.x, size.y, false);
            shotCamera.aspect = shotAspect;
            shotCamera.updateProjectionMatrix();
            pathRoot.visible = pathVisible;
            renderer.render(
                scene,
                mode === "camera" ? shotCamera : editorCamera
            );
        }
    }

    function dispose() {
        cancelAnimationFrame(frame);
        resizeObserver.disconnect();
        canvas.removeEventListener("pointerdown", onPointerDown, true);
        canvas.removeEventListener("pointermove", onPointerMove, true);
        canvas.removeEventListener("pointerup", onPointerUp, true);
        canvas.removeEventListener("pointercancel", onPointerCancel, true);
        canvas.removeEventListener("lostpointercapture", onPointerCancel, true);
        canvas.removeEventListener("contextmenu", preventContextMenu);
        canvas.removeEventListener("keydown", onKeyDown);
        canvas.removeEventListener("blur", clearKeys);
        window.removeEventListener("keyup", onKeyUp);
        window.removeEventListener("blur", clearKeys);
        controls.dispose();
        disposeTree(scene);
        renderer.dispose();
    }

    const preventContextMenu = (event: Event) => event.preventDefault();
    const clearKeys = () => keyStates.clear();
    canvas.addEventListener("pointerdown", onPointerDown, true);
    canvas.addEventListener("pointermove", onPointerMove, true);
    canvas.addEventListener("pointerup", onPointerUp, true);
    canvas.addEventListener("pointercancel", onPointerCancel, true);
    canvas.addEventListener("lostpointercapture", onPointerCancel, true);
    canvas.addEventListener("contextmenu", preventContextMenu);
    canvas.addEventListener("keydown", onKeyDown);
    canvas.addEventListener("blur", clearKeys);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", clearKeys);
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);
    resize();
    frame = requestAnimationFrame(render);

    return {
        loadSet,
        setShot,
        setArtworks,
        updateArtwork,
        setMode,
        setNavigationMode,
        setPathKind,
        setActivePathPoint,
        seek,
        cameraSample,
        capturePoster,
        resize,
        dispose,
    };
}
