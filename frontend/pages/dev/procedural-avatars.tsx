import { useEffect, useRef, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import {
    cmPerPixel,
    composition,
} from "@features/procedural-avatars/referenceProportions";
import {
    characters,
    type Character,
} from "@features/procedural-avatars/catalog";
import {
    cartoonCast,
    cartoonRecipe,
    type CastMember,
} from "@features/procedural-avatars/cartoonCast";
import type { ReferenceLayout } from "@features/procedural-avatars/referenceProportions";
import { styleOf } from "@features/procedural-avatars/styles";
import type { LobbyAvatar } from "@features/lobby/webgpu/avatarAdapter";

type View = Character | CastMember | "authored" | "lineup" | "streetwear";

export type Subject = {
    id: Character | CastMember | "authored";
    name: string;
    template: Character;
    source: string;
    layout?: ReferenceLayout;
    posedTPose?: boolean;
    coat?: boolean;
};
const studySubjects: Subject[] = characters.map((c) => ({
    ...c,
    template: c.id,
    source: c.id,
}));
const castSubjects: Subject[] = cartoonCast.map((c) => {
    const recipe = cartoonRecipe(c.id);
    return {
        id: c.id,
        name: c.name,
        template: recipe.template,
        source: "cast-" + c.id,
        posedTPose: !!recipe.cartoon?.fit?.sections,
        layout: recipe.layout,
    };
});
export default function AvatarStudy({
    cartoonOnly = false,
    customSubjects,
}: { cartoonOnly?: boolean; customSubjects?: Subject[] } = {}) {
    const subjects =
        customSubjects ?? (cartoonOnly ? castSubjects : studySubjects);
    const host = useRef<HTMLDivElement>(null);
    const canvas = useRef<HTMLCanvasElement>(null);
    const [closeup, setCloseup] = useState<"portrait" | "hand" | null>(() =>
        customSubjects &&
        typeof window !== "undefined" &&
        new URLSearchParams(window.location.search).get("focus") === "hand"
            ? "hand"
            : null
    );
    const [view, setView] = useState<View>(
        customSubjects ? "authored" : "rick-classic"
    );
    const [hasGaze, setHasGaze] = useState(false);
    const [gaze, setGaze] = useState(0);
    const [angle, setAngle] = useState(0);
    const [motion, setMotion] = useState(
        customSubjects ? "T-pose" : "Reference"
    );
    const [rawPaint, setRawPaint] = useState(false);
    const [silhouettes, setSilhouettes] = useState<boolean | "coat">(false);
    const [compareSun, setCompareSun] = useState(false);
    const [itemHand, setItemHand] = useState<"left" | "right" | null>(null);
    const [paused, setPaused] = useState(false);
    const [motionStep, setMotionStep] = useState(0);
    const [reference, setReference] = useState<File>();
    const [overlay, setOverlay] = useState(false);
    const [opacity, setOpacity] = useState(0.5);
    const [image, setImage] = useState("");
    const [status, setStatus] = useState("Building avatars…");
    const [detail, setDetail] = useState("");
    const controls = useRef({
        view,
        angle,
        gaze,
        motion,
        paused,
        motionStep,
        closeup,
        compareSun,
        silhouettes,
        rawPaint,
        itemHand,
    });
    controls.current = {
        view,
        angle,
        gaze,
        motion,
        paused,
        motionStep,
        closeup,
        compareSun,
        silhouettes,
        rawPaint,
        itemHand,
    };
    useEffect(() => {
        if (!reference) {
            setImage("");
            return;
        }
        const url = URL.createObjectURL(reference);
        setImage(url);
        return () => URL.revokeObjectURL(url);
    }, [reference]);
    useEffect(() => {
        const element = host.current;
        let stopped = false,
            cleanup = () => {};
        (async () => {
            const [T, { createAvatar }, { referencePose }, nodes] =
                await Promise.all([
                    import("three/webgpu"),
                    import("@features/lobby/webgpu/avatarAdapter"),
                    import("@features/procedural-avatars/referencePose"),
                    import("three/tsl"),
                ]);
            if (stopped) return;
            const renderer = new T.WebGPURenderer({
                canvas: canvas.current,
                antialias: true,
                forceWebGL:
                    new URLSearchParams(location.search).get("renderer") ===
                    "webgl",
            });
            const maskMaterial = new T.MeshBasicNodeMaterial({
                color: 0xffffff,
                side: T.DoubleSide,
            });
            const coatMask = new T.MeshBasicNodeMaterial({
                side: T.DoubleSide,
            });
            // The lining tile belongs to the outer coat on both faces.
            coatMask.colorNode = nodes.vec3(
                nodes.floor(nodes.uv().x).equal(29).select(1, 0)
            );
            const models: LobbyAvatar[] = [];
            const rawMaterial = new T.MeshBasicNodeMaterial({
                vertexColors: true,
                side: T.DoubleSide,
            });
            let studyMesh: InstanceType<typeof T.SkinnedMesh>,
                bakedPaint:
                    | InstanceType<typeof T.BufferAttribute>
                    | InstanceType<typeof T.InterleavedBufferAttribute>;
            let bakedMaterial: typeof studyMesh.material;
            let previousRaw = false;
            const ownedItems: InstanceType<typeof T.Mesh>[] = [];
            // One lathed, vertex-painted microphone shared by the study's hands.
            const micGeometry = new T.LatheGeometry(
                [
                    [-0.057, 0.004],
                    [-0.055, 0.009],
                    [0.01, 0.011],
                    [0.017, 0.013],
                    [0.023, 0.013],
                    [0.027, 0.02],
                    [0.04, 0.024],
                    [0.056, 0.019],
                    [0.063, 0.008],
                    [0.064, 0],
                ].map(([y, r]) => new T.Vector2(r, y)),
                12
            );
            const micColors: number[] = [];
            for (let i = 0; i < micGeometry.attributes.position.count; i++) {
                const y = micGeometry.attributes.position.getY(i);
                new T.Color(
                    y > 0.024 ? "#acb9bd" : y > 0.016 ? "#eca853" : "#30414e"
                ).toArray(micColors, 3 * i);
            }
            micGeometry.setAttribute(
                "color",
                new T.Float32BufferAttribute(micColors, 3)
            );
            const micMaterial = new T.MeshBasicNodeMaterial({
                vertexColors: true,
            });
            let previousHand: typeof itemHand,
                previousSubject = "",
                previousItemMotion = "",
                previousCompare = false;
            const travelReady = new Map<LobbyAvatar, boolean>();
            const crouchSampled = new Set<LobbyAvatar>();
            function poseCrouched(model: LobbyAvatar) {
                if (!travelReady.has(model)) {
                    travelReady.set(model, false);
                    model
                        .prepareTravel()
                        .then(() => {
                            if (!stopped) {
                                travelReady.set(model, true);
                                dirty = true;
                            }
                        })
                        .catch((e) => {
                            if (!stopped) setStatus(e.message);
                        });
                }
                const sampled =
                    travelReady.get(model) &&
                    model.sampleTravelPose({
                        name: "TRAVEL_CROUCH_IDLE",
                        time: 0.25,
                    });
                if (sampled) crouchSampled.add(model);
                else crouchSampled.delete(model);
            }
            let original: LobbyAvatar,
                loadingOriginal = false,
                restoreOriginal = () => {};
            const sunshineIndex = subjects.findIndex(
                (c) => c.id === "sunshine"
            );
            async function loadOriginal() {
                loadingOriginal = true;
                try {
                    const source = "/models/summer_unlit_fixed.vrm";
                    const m = await createAvatar(source);
                    if (stopped) {
                        m.dispose();
                        return;
                    }
                    if (m.sourceUrl !== source) {
                        m.dispose();
                        throw Error("Could not load the bundled Sunshine VRM");
                    }
                    original = m;
                    original.root.scale.multiplyScalar(
                        models[sunshineIndex].height / original.height
                    );
                    original.root.traverse((n) => {
                        const mesh = n as InstanceType<typeof T.SkinnedMesh>;
                        if (mesh.isSkinnedMesh) mesh.skeleton.pose();
                    });
                    const nodes: {
                        n: InstanceType<typeof T.Object3D>;
                        p: InstanceType<typeof T.Vector3>;
                        q: InstanceType<typeof T.Quaternion>;
                    }[] = [];
                    original.root.traverse((n) => {
                        if ((n as InstanceType<typeof T.Bone>).isBone)
                            nodes.push({
                                n,
                                p: n.position.clone(),
                                q: n.quaternion.clone(),
                            });
                    });
                    restoreOriginal = () =>
                        nodes.forEach(({ n, p, q }) => {
                            n.position.copy(p);
                            n.quaternion.copy(q);
                        });
                    scene.add(original.root);
                    setStatus("");
                    dirty = true;
                } catch (e) {
                    if (!stopped) setStatus(e.message);
                }
            }
            const observer = new ResizeObserver(() => resize());
            let frame = 0;
            let dirty = true;
            let previousControls: typeof controls.current;
            cleanup = () => {
                observer.disconnect();
                cancelAnimationFrame(frame);
                if (studyMesh && bakedPaint) {
                    studyMesh.geometry.setAttribute("color", bakedPaint);
                    studyMesh.material = bakedMaterial;
                }
                rawMaterial.dispose();
                for (const model of models) model.dispose();
                original?.dispose();
                micGeometry.dispose();
                micMaterial.dispose();
                maskMaterial.dispose();
                coatMask.dispose();
                renderer.dispose();
            };
            await renderer.init();
            if (stopped) return;
            canvas.current.dataset.backend = renderer.backend.constructor.name;
            renderer.setPixelRatio(Math.min(2, devicePixelRatio));

            const scene = new T.Scene();
            scene.background = new T.Color("#e8e2d6");
            const camera = new T.OrthographicCamera(-2, 2, 1, -1, 0.01, 30);
            function resize() {
                renderer.setSize(element.clientWidth, element.clientHeight);
                dirty = true;
            }
            observer.observe(element);
            resize();
            for (const { id, source: slug } of subjects) {
                const source =
                    "/models/procedural/" +
                    (id === "rick-classic" ? "rick-paint-study" : slug);
                const model = await createAvatar(source);
                if (stopped) {
                    model.dispose();
                    return;
                }
                if (model.sourceUrl !== source) {
                    model.dispose();
                    throw Error("Could not build " + id);
                }
                if (id === "rick-classic") {
                    studyMesh = model.root.getObjectByProperty(
                        "isSkinnedMesh",
                        true
                    ) as typeof studyMesh;
                    bakedPaint = studyMesh.geometry.getAttribute("color");
                    bakedMaterial = studyMesh.material;
                }
                models.push(model);
                ownedItems.push(new T.Mesh(micGeometry, micMaterial));
                scene.add(model.root);
            }
            setHasGaze(models.length === 1 && !!models[0].setGazePose);
            const handNodes = models.map((model) =>
                (["right", "left"] as const).map((side) => ({
                    wrist: model.root.getObjectByName(side + "Hand"),
                    tip: model.root.getObjectByName(side + "MiddleDistal"),
                    digits: ["Thumb", "Index", "Middle", "Ring", "Little"].map(
                        (finger) =>
                            model.root.getObjectByName(side + finger + "Distal")
                    ),
                }))
            );
            const minGripCurl = models.map(() => 0);
            const wristCenter = new T.Vector3(),
                fingertip = new T.Vector3();
            const metrics = models.map((model) => {
                let triangles = 0;
                model.root.traverse((object) => {
                    const mesh = object as InstanceType<typeof T.Mesh>;
                    if (mesh.isMesh)
                        triangles +=
                            (mesh.geometry.index?.count ??
                                mesh.geometry.attributes.position.count) / 3;
                });
                return { triangles, height: model.height };
            });
            let restore: (() => void)[] = [];
            const referenceFloor = models.map(() => 0);
            let previous = performance.now(),
                lastView = "",
                lastMotion = "";
            const draw = (now: number) => {
                if (stopped) return;
                const {
                    view,
                    angle,
                    gaze,
                    motion,
                    paused,
                    motionStep,
                    closeup,
                    compareSun,
                    silhouettes,
                    rawPaint,
                    itemHand,
                } = controls.current;
                const dt = Math.min(0.05, (now - previous) / 1000);
                previous = now;
                if (
                    (paused || motion === "Reference" || motion === "T-pose") &&
                    previousControls === controls.current &&
                    !dirty
                ) {
                    frame = requestAnimationFrame(draw);
                    return;
                }
                const step =
                    paused &&
                    motionStep !== (previousControls?.motionStep ?? 0);
                const elapsed = step ? 0.09 : paused ? 0 : dt;
                previousControls = controls.current;
                dirty = false;
                const raw = view === "rick-classic" && rawPaint;
                if (raw !== previousRaw) {
                    studyMesh.geometry.setAttribute(
                        "color",
                        raw
                            ? studyMesh.geometry.userData.referencePaint
                            : bakedPaint
                    );
                    studyMesh.material = raw ? rawMaterial : bakedMaterial;
                    previousRaw = raw;
                }
                canvas.current.dataset.paint = raw ? "mrgb" : "baked";
                const street = view === "streetwear";
                const lineup = view === "lineup" || street,
                    index = subjects.findIndex((c) => c.id === view);
                const aspect =
                    element.clientWidth / Math.max(1, element.clientHeight);
                const compare = view === "sunshine" && compareSun;
                scene.overrideMaterial =
                    (compare ||
                        view === "rick-classic" ||
                        view === "authored") &&
                    silhouettes
                        ? silhouettes === "coat"
                            ? coatMask
                            : maskMaterial
                        : null;
                (scene.background as InstanceType<typeof T.Color>).set(
                    (compare ||
                        view === "rick-classic" ||
                        view === "authored") &&
                        silhouettes
                        ? 0x000000
                        : 0xe8e2d6
                );
                if (compare && !loadingOriginal) {
                    setStatus("Loading the bundled reference VRM…");
                    void loadOriginal();
                }
                const portrait = closeup === "portrait" && !lineup && !compare;
                const hand =
                    closeup === "hand" && view === "authored"
                        ? handNodes[index]?.[itemHand === "left" ? 1 : 0]
                        : undefined;
                const focusHand = !!(hand?.wrist && hand.tip);
                const layout =
                    view === "authored" ? subjects[index]?.layout : undefined;
                const headHeight = layout
                    ? (models[index].height * layout.landmarks.jaw[1]) /
                      layout.origin.floor
                    : undefined;
                const half = focusHand
                    ? Math.max(
                          models[index].height * 0.088,
                          (models[index].height * 0.095) / aspect
                      )
                    : Math.max(
                          portrait
                              ? headHeight
                                  ? headHeight * 0.94
                                  : 0.325
                              : lineup
                              ? (street ? 375 : 382) * cmPerPixel * 0.01
                              : models[index].height * 0.56,
                          (compare
                              ? 2.12
                              : portrait
                              ? 0.28
                              : lineup
                              ? 425 * cmPerPixel * 0.01
                              : view === "sunshine"
                              ? 1.03
                              : 0.56) / aspect
                      );
                const center = portrait
                    ? models[index].height -
                      (headHeight ? headHeight * 0.65 : 0.24)
                    : lineup
                    ? (street ? 352 : 351) * cmPerPixel * 0.01
                    : models[index].height * 0.5;
                camera.left = -half * aspect;
                camera.right = half * aspect;
                camera.top = half;
                camera.bottom = -half;
                camera.position.set(0, center, -5);
                camera.lookAt(0, center, 0);
                camera.updateProjectionMatrix();
                if (models.length === 1) models[0].setGazePose?.(gaze);
                canvas.current.dataset.gaze = String(gaze);
                if (lastMotion !== motion) {
                    restore.forEach((fn) => fn());
                    restore = [];
                    if (motion === "T-pose")
                        models.forEach((model, i) => {
                            if (subjects[i].posedTPose) {
                                restore.push(
                                    referencePose(
                                        model.root,
                                        subjects[i].template,
                                        subjects[i].layout
                                    )
                                );
                                return;
                            }
                            model.root.traverse((n) => {
                                const m = n as InstanceType<
                                    typeof T.SkinnedMesh
                                >;
                                if (m.isSkinnedMesh) m.skeleton.pose();
                            });
                        });
                    if (motion === "Reference") restoreOriginal();
                    if (motion === "Reference")
                        restore = models.map((m, i) =>
                            referencePose(
                                m.root,
                                subjects[i].template,
                                subjects[i].layout
                            )
                        );
                    if (motion === "Reference")
                        models.forEach((model, i) => {
                            if (
                                ["lux", "remy", "vale"].includes(subjects[i].id)
                            ) {
                                model.root.updateMatrixWorld(true);
                                referenceFloor[i] =
                                    model.root.position.y -
                                    new T.Box3().setFromObject(model.root, true)
                                        .min.y;
                            }
                        });
                }
                models.forEach((model, i) => {
                    model.root.visible = lineup
                        ? (street
                              ? ["lux", "remy", "vale"]
                              : ["morty", "summer", "rick"]
                          ).includes(subjects[i].id)
                        : i === index;
                    model.root.position.x = lineup
                        ? ((street ? 385 : 425) -
                              composition[subjects[i].template].x) *
                          cmPerPixel *
                          0.01
                        : compare
                        ? -1.05
                        : 0;
                    model.root.position.y = lineup
                        ? (704 - composition[subjects[i].template].floor) *
                          cmPerPixel *
                          0.01
                        : 0;
                    if (motion === "Reference")
                        model.root.position.y += referenceFloor[i];
                    model.root.rotation.y = (angle * Math.PI) / 180;
                    if (
                        motion !== "Reference" &&
                        motion !== "T-pose" &&
                        model.root.visible &&
                        (motion === "Crouch" ||
                            !paused ||
                            step ||
                            lastMotion !== motion ||
                            lastView !== view)
                    )
                        if (motion === "Crouch") poseCrouched(model);
                        else model.update(elapsed, motion);
                    if (
                        previousHand !== itemHand ||
                        previousSubject !== view ||
                        previousItemMotion !== motion ||
                        previousCompare !== compare
                    ) {
                        if (previousHand) model.equipItem?.(previousHand, null);
                        minGripCurl[i] = 0;
                        if (itemHand && model.root.visible && !compare) {
                            const digits =
                                handNodes[i][itemHand === "right" ? 0 : 1]
                                    .digits;
                            const before = digits.map((joint) =>
                                joint?.quaternion.clone()
                            );
                            model.equipItem?.(itemHand, ownedItems[i], {
                                radius: 0.011,
                            });
                            minGripCurl[i] = Math.min(
                                ...digits.map((joint, j) =>
                                    joint
                                        ? joint.quaternion.angleTo(before[j])
                                        : 0
                                )
                            );
                        }
                    }
                });
                if (original) {
                    original.root.visible = compare;
                    original.root.position.x = 1.05;
                    original.root.rotation.y = (angle * Math.PI) / 180;
                    if (
                        compare &&
                        motion !== "Reference" &&
                        motion !== "T-pose" &&
                        (motion === "Crouch" ||
                            !paused ||
                            step ||
                            lastMotion !== motion)
                    )
                        if (motion === "Crouch") poseCrouched(original);
                        else original.update(elapsed, motion);
                }
                if (lastView !== view) {
                    const stats = lineup
                        ? metrics.filter((_, i) => models[i].root.visible)
                        : [metrics[index]];
                    setDetail(
                        stats
                            .reduce((sum, item) => sum + item.triangles, 0)
                            .toLocaleString() +
                            " triangles · " +
                            stats.length +
                            " skinned mesh" +
                            (lineup ? "es" : "")
                    );
                    lastView = view;
                }
                previousHand = itemHand;
                previousSubject = view;
                previousItemMotion = motion;
                previousCompare = compare;
                const mount = ownedItems[index]?.parent;
                const wristIndex = mount?.parent
                    ? handNodes[index].findIndex(
                          (h) => h.wrist === mount.parent
                      )
                    : -1;
                canvas.current.dataset.grip =
                    ["right", "left"][wristIndex] ?? "";
                canvas.current.dataset.minGripCurl = String(
                    minGripCurl[index] ?? 0
                );
                canvas.current.dataset.itemReleased = String(
                    !mount &&
                        !handNodes[index]?.some(({ wrist }) =>
                            wrist?.children.some(
                                (child) =>
                                    child.name === "leftGrip" ||
                                    child.name === "rightGrip"
                            )
                        )
                );
                canvas.current.dataset.pose =
                    motion === "Crouch" &&
                    (!models.every(
                        (m) => !m.root.visible || crouchSampled.has(m)
                    ) ||
                        (compare && !crouchSampled.has(original)))
                        ? "loading"
                        : motion;
                lastMotion = motion;
                if (focusHand) {
                    hand.wrist.getWorldPosition(wristCenter);
                    hand.tip.getWorldPosition(fingertip);
                    wristCenter.lerp(fingertip, 0.56);
                    camera.position.copy(wristCenter);
                    camera.position.z -= 5;
                    camera.lookAt(wristCenter);
                    camera.updateMatrixWorld();
                }
                renderer.render(scene, camera);
                canvas.current.dataset.coatMask = String(
                    scene.overrideMaterial === coatMask
                );
                canvas.current.dataset.silhouette = String(
                    !!scene.overrideMaterial
                );
                canvas.current.dataset.pairOffset = String(
                    (2.1 * element.clientWidth) / (2 * half * aspect)
                );
                canvas.current.dataset.comparison =
                    compare && original ? "ready" : "";
                if (view === "rick-classic" && motion === "Reference") {
                    // Project one source-space unit along each axis from the measured hip.
                    // The offline comparator uses this exact camera, including normalized height.
                    const hip = models[index].root.getObjectByName("hips");
                    const basis = [
                        [0, 0, 0],
                        [1, 0, 0],
                        [0, 1, 0],
                        [0, 0, 1],
                    ].map(([x, y, z]) => {
                        const v = hip
                            .localToWorld(
                                new T.Vector3(x, y, z).multiplyScalar(
                                    cmPerPixel * 0.01
                                )
                            )
                            .project(camera);
                        return [
                            (1 + v.x) * element.clientWidth * 0.5 - 0.5,
                            (1 - v.y) * element.clientHeight * 0.5 - 0.5,
                            -v.z,
                        ];
                    });
                    canvas.current.dataset.referenceBasis =
                        JSON.stringify(basis);
                }
                canvas.current.dataset.motionStep = String(motionStep);
                if (view === "authored")
                    canvas.current.dataset.reviewCamera = JSON.stringify({
                        center: focusHand ? wristCenter.y : center,
                        height: half * 2,
                        pixels: element.clientHeight,
                    });
                canvas.current.dataset.framing = [
                    view,
                    angle,
                    focusHand ? "hand" : portrait ? "portrait" : "body",
                ].join("/");
                frame = requestAnimationFrame(draw);
            };
            setStatus("");
            frame = requestAnimationFrame(draw);
        })().catch((error) => {
            if (!stopped) setStatus(error.message || "Preview failed");
        });
        return () => {
            stopped = true;
            cleanup();
        };
    }, [subjects]);
    return (
        <main>
            <Head>
                <title>Avatar studies · Oncyber</title>
            </Head>
            <header>
                <h1>
                    {customSubjects
                        ? customSubjects[0].name
                        : cartoonOnly
                        ? "Rick and Morty style study"
                        : "Avatar studies"}
                </h1>
                {!customSubjects?.[0]?.source.startsWith("preview-") && (
                    <Link
                        href={
                            customSubjects?.[0]?.source.startsWith("drawn-")
                                ? "/dev/procedural-crowd?cast=cartoon&guest=" +
                                  encodeURIComponent(
                                      customSubjects[0].source.slice(6)
                                  )
                                : cartoonOnly
                                ? "/dev/procedural-crowd?cast=cartoon"
                                : "/dev/procedural-crowd"
                        }
                    >
                        100-recipe crowd
                    </Link>
                )}
                <label className="reference">
                    Compare reference
                    <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => setReference(e.target.files?.[0])}
                    />
                </label>
            </header>
            <section
                className={image && overlay ? "overlay" : ""}
                aria-label="Model and reference"
            >
                {image && (
                    <figure>
                        <img
                            style={{ opacity: overlay ? opacity : 1 }}
                            src={image}
                            alt="Uploaded character reference"
                        />
                        <button onClick={() => setReference(undefined)}>
                            Remove reference
                        </button>
                    </figure>
                )}
                <div className="stage" ref={host}>
                    <canvas
                        ref={canvas}
                        aria-label="Animated procedural avatars"
                    />
                    {view === "sunshine" && compareSun && !silhouettes && (
                        <aside>
                            <span>Original VRM</span>
                            <span>Procedural recipe</span>
                        </aside>
                    )}
                    {status && <output>{status}</output>}
                </div>
            </section>
            <footer>
                <label>
                    Subject
                    <select
                        aria-label="Subject"
                        value={view}
                        onChange={(e) => setView(e.target.value as View)}
                    >
                        {customSubjects || cartoonOnly ? (
                            subjects.map((c) => (
                                <option key={c.id} value={c.id}>
                                    {c.name}
                                </option>
                            ))
                        ) : (
                            <>
                                <option value="lineup">
                                    Original illustration
                                </option>
                                <option value="streetwear">
                                    Streetwear illustration
                                </option>
                                {(
                                    [
                                        ["cartoon", "Rick and Morty"],
                                        ["sunshine", "Oncyber Sunshine"],
                                        ["streetwear", "Streetwear"],
                                    ] as const
                                ).map(([style, label]) => (
                                    <optgroup key={style} label={label}>
                                        {characters
                                            .filter(
                                                (c) => styleOf[c.id] === style
                                            )
                                            .map((c) => (
                                                <option key={c.id} value={c.id}>
                                                    {c.name}
                                                </option>
                                            ))}
                                    </optgroup>
                                ))}
                            </>
                        )}
                    </select>
                </label>
                <label>
                    Motion
                    <select
                        aria-label="Motion"
                        value={motion}
                        onChange={(e) => setMotion(e.target.value)}
                    >
                        {[
                            "Reference",
                            ...(customSubjects ? ["T-pose"] : []),
                            "IDLE",
                            "WALK",
                            "RUN",
                            "JUMP",
                            "Crouch",
                            "WAVING",
                        ].map((m) => (
                            <option key={m}>{m}</option>
                        ))}
                    </select>
                </label>
                {hasGaze && (
                    <label>
                        Gaze pose · {Math.round(gaze * 100)}%
                        <input
                            aria-label="Gaze pose"
                            type="range"
                            min="0"
                            max="1"
                            step="0.01"
                            value={gaze}
                            onChange={(e) => setGaze(Number(e.target.value))}
                        />
                    </label>
                )}
                <label>
                    Rotation · {angle}°
                    <input
                        type="range"
                        min="-180"
                        max="180"
                        aria-label="Rotation"
                        value={angle}
                        onChange={(e) => setAngle(Number(e.target.value))}
                    />
                </label>
                {!(view === "sunshine" && compareSun) && (
                    <button
                        onClick={() =>
                            setItemHand(
                                itemHand === null
                                    ? "right"
                                    : itemHand === "right"
                                    ? "left"
                                    : null
                            )
                        }
                    >
                        {itemHand === null
                            ? "Hold microphone"
                            : itemHand === "right"
                            ? "Switch to left hand"
                            : "Release microphone"}
                    </button>
                )}
                {view === "sunshine" && (
                    <button
                        aria-pressed={compareSun}
                        onClick={() => setCompareSun(!compareSun)}
                    >
                        {compareSun ? "Single avatar" : "Compare default VRM"}
                    </button>
                )}
                {view === "rick-classic" && (
                    <button
                        aria-pressed={rawPaint}
                        onClick={() => setRawPaint(!rawPaint)}
                    >
                        {rawPaint ? "Show baked paint" : "Show OBJ swatches"}
                    </button>
                )}
                {((view === "sunshine" && compareSun) ||
                    view === "rick-classic" ||
                    view === "authored") && (
                    <button
                        style={{ minWidth: 150 }}
                        aria-pressed={silhouettes === true}
                        onClick={() => setSilhouettes(!silhouettes)}
                    >
                        {silhouettes ? "Show paint" : "Compare silhouettes"}
                    </button>
                )}
                {view === "authored" && customSubjects?.some((s) => s.coat) && (
                    <button
                        aria-pressed={silhouettes === "coat"}
                        onClick={() =>
                            setSilhouettes(
                                silhouettes === "coat" ? false : "coat"
                            )
                        }
                    >
                        Isolate coat panels
                    </button>
                )}
                <button
                    disabled={
                        view === "lineup" ||
                        view === "streetwear" ||
                        (view === "sunshine" && compareSun)
                    }
                    aria-pressed={closeup === "portrait"}
                    onClick={() =>
                        setCloseup(closeup === "portrait" ? null : "portrait")
                    }
                >
                    {closeup === "portrait" ? "Full body" : "Portrait"}
                </button>
                {view === "authored" && (
                    <button
                        aria-pressed={closeup === "hand"}
                        onClick={() =>
                            setCloseup(closeup === "hand" ? null : "hand")
                        }
                    >
                        {closeup === "hand" ? "Full body" : "Inspect hand"}
                    </button>
                )}
                <button onClick={() => setPaused(!paused)}>
                    {paused ? "Play" : "Pause"}
                </button>
                {paused &&
                    motion !== "Reference" &&
                    motion !== "T-pose" &&
                    motion !== "Crouch" && (
                        <button onClick={() => setMotionStep((n) => n + 1)}>
                            Advance 90 ms
                        </button>
                    )}
                {image && (
                    <button
                        aria-pressed={overlay}
                        onClick={() => setOverlay(!overlay)}
                    >
                        {overlay ? "Side by side" : "Overlay"}
                    </button>
                )}
                {image && overlay && (
                    <label>
                        Reference opacity
                        <input
                            type="range"
                            min="0"
                            max="1"
                            step=".05"
                            value={opacity}
                            onChange={(e) => setOpacity(Number(e.target.value))}
                        />
                    </label>
                )}
                <small>{detail}</small>
            </footer>
            <style jsx>{`
                main {
                    display: flex;
                    flex-direction: column;
                    min-height: 100vh;
                    background: #f7f5ef;
                    color: #272722;
                    font-family: "DM Sans", system-ui, sans-serif;
                }
                header,
                footer {
                    display: flex;
                    align-items: center;
                    gap: 24px;
                    padding: 18px 4vw;
                    flex-wrap: wrap;
                }
                header {
                    justify-content: space-between;
                }
                h1 {
                    margin: 0;
                    font: normal clamp(26px, 3vw, 44px) Georgia, serif;
                    letter-spacing: -0.04em;
                }
                section {
                    display: flex;
                    flex: 1;
                    min-height: 54vh;
                }
                section.overlay {
                    position: relative;
                }
                section.overlay figure {
                    position: absolute;
                    inset: 0;
                    z-index: 1;
                    background: transparent;
                    pointer-events: none;
                }
                section.overlay figure button {
                    pointer-events: auto;
                }
                .stage,
                figure {
                    min-width: 0;
                    flex: 1;
                    position: relative;
                    margin: 0;
                    background: #e8e2d6;
                }
                aside {
                    position: absolute;
                    left: 0;
                    right: 0;
                    bottom: 10px;
                    display: flex;
                    justify-content: space-around;
                    font: 13px system-ui;
                    pointer-events: none;
                }
                .stage :global(canvas) {
                    position: absolute;
                    inset: 0;
                }
                output {
                    position: absolute;
                    z-index: 1;
                    inset: 44% 0 auto;
                    text-align: center;
                }
                figure img {
                    width: 100%;
                    height: 100%;
                    position: absolute;
                    object-fit: contain;
                }
                figure button {
                    position: absolute;
                    right: 12px;
                    bottom: 12px;
                }
                label {
                    display: grid;
                    gap: 6px;
                    font-size: 12px;
                }
                .reference,
                button,
                select {
                    font: inherit;
                    color: inherit;
                    border: 1px solid #bdb8ac;
                    border-radius: 6px;
                    background: #faf9f5;
                    padding: 8px 12px;
                    cursor: pointer;
                }
                .reference {
                    position: relative;
                    font-size: 14px;
                }
                .reference input {
                    position: absolute;
                    inset: 0;
                    opacity: 0;
                    cursor: pointer;
                    width: 100%;
                }
                input[type="range"] {
                    accent-color: #535d45;
                }
                small {
                    margin-left: auto;
                    color: #53564c;
                }
                @media (max-width: 680px) {
                    header,
                    footer {
                        gap: 12px;
                    }
                    section:has(figure) {
                        flex-direction: column;
                        min-height: 70vh;
                    }
                    small {
                        width: 100%;
                    }
                }
            `}</style>
        </main>
    );
}

export function getServerSideProps() {
    return process.env.NODE_ENV === "development"
        ? { props: {} }
        : { notFound: true };
}
