import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    useSyncExternalStore,
} from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
    createDemoProject,
    createDemoShot,
    constructProceduralSet,
    DEMO_SET_OPTIONS,
    findSetOption,
    searchSetCatalog,
    selectActiveShot,
    selectAvailableSets,
    selectArtworksForShot,
    selectOrderedShots,
    selectResolvedSetId,
    selectSetForShot,
    type SetOption,
    type VideoArtwork,
    type VideoOperation,
} from "./model";
import { createEditorStore, type VideoEditorStore } from "./store";
import {
    createCameraManifest,
    fingerprint,
    MockVideoProvider,
    type VideoGenerationJob,
} from "./guide";
import {
    artworkToEngine,
    setOptionToEngine,
    shotToEngine,
} from "./engine/adapters";
import type {
    NavigationMode,
    PathKind,
    ViewMode,
} from "./engine/createVideoEngine";
import {
    createRefineProposal,
    createSequenceProposal,
} from "./director/demoDirector";
import { DirectorChat, type DirectorMessage } from "./components/DirectorChat";
import {
    DirectorBriefing,
    type DirectorBriefingHandle,
} from "./components/DirectorBriefing";
import { TunedInspector as Inspector } from "./components/TunedInspector";
import { Timeline } from "./components/Timeline";
import {
    ProjectSwitcher,
    type VideoProjectSummary,
} from "./components/ProjectSwitcher";
import { SetBuilder, type SetBuilderValue } from "./components/SetBuilder";
import {
    VideoAssetLibrary,
    type VideoLibraryAsset,
} from "./components/VideoAssetLibrary";
import {
    VideoViewport,
    type VideoViewportHandle,
} from "./components/VideoViewport";
import { StudioTheme } from "@features/studio/styles/StudioTheme";
import { StudioSceneFrame } from "@features/studio/components/StudioSceneFrame";
import { OncyberLockup } from "@features/studio/components/OncyberLockup";
import { StudioAssetDock } from "@features/studio/EditWorldMenu/AddAsset/AddAssetLayout/StudioAssetDock";
import {
    NftOpt,
    type AssetOption,
} from "@features/studio/EditWorldMenu/AddAsset/shared/AssetTypes";
import { StudioToolbarFrame } from "@features/studio/StudioMenu/components/StudioToolbarFrame";
import {
    ToolbarButton,
    ToolbarButtonLabel,
} from "@features/studio/StudioMenu/components/ToolbarButton";
import {
    CameraIcon,
    CheckIcon,
    ComposeIcon,
    DownloadIcon,
    FilmIcon,
    ImageIcon,
    MapIcon,
    PathIcon,
    RedoIcon,
    SparklesIcon,
    UndoIcon,
} from "./components/Icons";
import styles from "./VideoStudioShell.module.css";

const makeId = (prefix: string) =>
    `${prefix}-${Date.now().toString(36)}-${Math.random()
        .toString(36)
        .slice(2, 7)}`;

const INITIAL_MESSAGES: DirectorMessage[] = [
    {
        id: "welcome",
        role: "assistant",
        text: "Describe the film you want to make. I’ll suggest editable 3D sets, block the camera, and propose each change before it touches your sequence.",
    },
];

type DirectorPhase = "brief" | "sets" | "editing";

type WorkspaceSurface = "conversation" | "preview" | "editor";
type SeedanceMode = "t2v" | "omni_reference" | "video_edit" | "video_extension";
type SeedanceAspectRatio =
    | "auto"
    | "21:9"
    | "16:9"
    | "4:3"
    | "1:1"
    | "3:4"
    | "9:16";
type SeedanceResolution = "480p" | "720p" | "1080p";
type GuideMode = "auto" | "none" | "3d";

interface BriefingSettings {
    readonly modelId: "seedance_2_5";
    readonly mode: SeedanceMode;
    readonly durationSeconds: number;
    readonly aspectRatio: SeedanceAspectRatio;
    readonly resolution: SeedanceResolution;
    readonly generateAudio: boolean;
    readonly guideMode: GuideMode;
}

interface BriefingReference {
    readonly id: string;
    readonly name: string;
    readonly kind: "image" | "video" | "audio";
    readonly size: number;
}

interface ProjectWorkflow {
    readonly lifecycle: "draft" | "active";
    readonly brief: string;
    readonly settings: BriefingSettings;
    readonly references: readonly BriefingReference[];
}

interface ProjectSeed {
    readonly id: string;
    readonly title: string;
    readonly setId: string;
    readonly workflow?: ProjectWorkflow;
}

interface DirectorSession {
    readonly messages: readonly DirectorMessage[];
    readonly choices: readonly SetOption[];
    readonly brief: string;
    readonly draft: string;
    readonly phase: DirectorPhase;
}

const DEFAULT_BRIEFING_SETTINGS: BriefingSettings = {
    modelId: "seedance_2_5",
    mode: "t2v",
    durationSeconds: 10,
    aspectRatio: "16:9",
    resolution: "720p",
    generateAudio: true,
    guideMode: "auto",
};

function defaultWorkflow(lifecycle: "draft" | "active"): ProjectWorkflow {
    return {
        lifecycle,
        brief: "",
        settings: DEFAULT_BRIEFING_SETTINGS,
        references: [],
    };
}

function normalizeWorkflow(value: unknown): ProjectWorkflow {
    if (!value || typeof value !== "object") return defaultWorkflow("active");
    const candidate = value as Partial<ProjectWorkflow>;
    const settings = candidate.settings as
        | Partial<BriefingSettings>
        | undefined;
    const references = Array.isArray(candidate.references)
        ? candidate.references.filter(
              (reference): reference is BriefingReference =>
                  !!reference &&
                  typeof reference.id === "string" &&
                  typeof reference.name === "string" &&
                  ["image", "video", "audio"].includes(reference.kind) &&
                  typeof reference.size === "number"
          )
        : [];
    const modes: readonly SeedanceMode[] = [
        "t2v",
        "omni_reference",
        "video_edit",
        "video_extension",
    ];
    const ratios: readonly SeedanceAspectRatio[] = [
        "auto",
        "21:9",
        "16:9",
        "4:3",
        "1:1",
        "3:4",
        "9:16",
    ];
    const resolutions: readonly SeedanceResolution[] = [
        "480p",
        "720p",
        "1080p",
    ];
    const guides: readonly GuideMode[] = ["auto", "none", "3d"];
    return {
        lifecycle: candidate.lifecycle === "draft" ? "draft" : "active",
        brief: typeof candidate.brief === "string" ? candidate.brief : "",
        settings: {
            modelId: "seedance_2_5",
            mode: modes.includes(settings?.mode as SeedanceMode)
                ? (settings?.mode as SeedanceMode)
                : DEFAULT_BRIEFING_SETTINGS.mode,
            durationSeconds: Math.max(
                4,
                Math.min(
                    30,
                    Number.isFinite(settings?.durationSeconds)
                        ? Math.round(settings?.durationSeconds as number)
                        : DEFAULT_BRIEFING_SETTINGS.durationSeconds
                )
            ),
            aspectRatio: ratios.includes(
                settings?.aspectRatio as SeedanceAspectRatio
            )
                ? (settings?.aspectRatio as SeedanceAspectRatio)
                : DEFAULT_BRIEFING_SETTINGS.aspectRatio,
            resolution: resolutions.includes(
                settings?.resolution as SeedanceResolution
            )
                ? (settings?.resolution as SeedanceResolution)
                : DEFAULT_BRIEFING_SETTINGS.resolution,
            generateAudio:
                typeof settings?.generateAudio === "boolean"
                    ? settings.generateAudio
                    : DEFAULT_BRIEFING_SETTINGS.generateAudio,
            guideMode: guides.includes(settings?.guideMode as GuideMode)
                ? (settings?.guideMode as GuideMode)
                : DEFAULT_BRIEFING_SETTINGS.guideMode,
        },
        references: references.slice(0, 50),
    };
}

const PROJECT_REGISTRY_KEY = "oncyber-video-lab:workspace:v1";
const ACTIVE_PROJECT_KEY = "oncyber-video-lab:active-project:v1";
const PROJECT_SEEDS: readonly ProjectSeed[] = [
    {
        id: "video-demo",
        title: "Untitled video",
        setId: "white-cube",
        workflow: defaultWorkflow("active"),
    },
    {
        id: "product-launch",
        title: "Product launch",
        setId: "cobalt-pavilion",
        workflow: defaultWorkflow("active"),
    },
    {
        id: "collection-film",
        title: "Collection film",
        setId: "sunset-monoliths",
        workflow: defaultWorkflow("active"),
    },
];

function readProjectRegistry(): ProjectSeed[] {
    if (typeof window === "undefined") return [...PROJECT_SEEDS];
    try {
        const parsed = JSON.parse(
            window.localStorage.getItem(PROJECT_REGISTRY_KEY) || "null"
        );
        if (!Array.isArray(parsed)) return [...PROJECT_SEEDS];
        const custom = parsed
            .filter(
                (entry): entry is ProjectSeed =>
                    !!entry &&
                    typeof entry.id === "string" &&
                    /^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/.test(entry.id) &&
                    typeof entry.title === "string" &&
                    entry.title.length <= 120 &&
                    typeof entry.setId === "string"
            )
            .map((entry) => ({
                ...entry,
                workflow: normalizeWorkflow(entry.workflow),
            }));
        const byId = new Map(PROJECT_SEEDS.map((entry) => [entry.id, entry]));
        custom.forEach((entry) => byId.set(entry.id, entry));
        return [...byId.values()].slice(0, 30);
    } catch {
        return [...PROJECT_SEEDS];
    }
}

function writeProjectRegistry(entries: readonly ProjectSeed[]) {
    try {
        window.localStorage.setItem(
            PROJECT_REGISTRY_KEY,
            JSON.stringify(entries)
        );
    } catch {
        // Project journals still work when registry persistence is unavailable.
    }
}

function journalKeyForProject(id: string) {
    return id === "video-demo"
        ? "oncyber-video-lab:v1"
        : `oncyber-video-lab:project:${id}:v1`;
}

function createProjectEditor(seed: ProjectSeed): VideoEditorStore {
    return createEditorStore(
        createDemoProject({
            id: seed.id,
            title: seed.title,
            setId: seed.setId,
        }),
        {
            journalKey: journalKeyForProject(seed.id),
            catalog: DEMO_SET_OPTIONS,
            maxHistory: 40,
        }
    );
}

const usesSingleOverlay = () =>
    typeof window !== "undefined" &&
    window.matchMedia("(max-width: 1000px)").matches;

function download(name: string, value: Blob | string) {
    const url = typeof value === "string" ? value : URL.createObjectURL(value);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = name;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    if (typeof value !== "string") URL.revokeObjectURL(url);
}

function artworkPosition(
    setId: string,
    index: number
): readonly [number, number, number] {
    const x = ((index % 3) - 1) * 2.6;
    if (setId === "cobalt-pavilion") return [x, 2.1, -8.75];
    if (setId === "sunset-monoliths") return [x, 2.1, -3.1];
    return [x, 2.1, -6.78];
}

function estimateSeedanceCredits(settings: BriefingSettings) {
    const creditsPerSecond =
        settings.resolution === "1080p"
            ? 9
            : settings.resolution === "720p"
            ? 6.5
            : 2.5;
    return Math.ceil(settings.durationSeconds * creditsPerSecond);
}

function compileSeedancePrompt(
    creativeBrief: string,
    settings: BriefingSettings,
    references: readonly BriefingReference[]
) {
    const referenceContract = references.length
        ? `REFERENCES: Use ${references
              .map((reference) => `${reference.name} (${reference.kind})`)
              .join(
                  ", "
              )} only for the named subject, environment, motion or sound. Preserve untargeted framing, timing and content.`
        : "REFERENCES: None. Establish continuity from the written direction.";
    return [
        `GLOBAL DIRECTION: ${creativeBrief.trim()}`,
        `FORMAT: ${settings.durationSeconds}s, ${settings.aspectRatio}, ${settings.resolution}.`,
        "STORY: Build a clear opening image, a purposeful camera/action beat, and a resolved final frame. Keep cuts and transitions intentional.",
        "CAMERA: Use physically coherent motion with stable subject geometry. Avoid accidental zooms, drift and jitter.",
        settings.generateAudio
            ? "AUDIO: Generate synchronized ambience, effects and music that support the beats without obscuring dialogue."
            : "AUDIO: Silent output.",
        referenceContract,
    ].join("\n");
}

function directorSetChoices(creativeBrief: string): readonly SetOption[] {
    const matches = searchSetCatalog(creativeBrief);
    const source = matches.length ? matches : DEMO_SET_OPTIONS;
    return [...source].sort((left, right) => {
        if (left.id === "white-cube") return 1;
        if (right.id === "white-cube") return -1;
        return 0;
    });
}

export default function VideoStudioLab() {
    const [projectSeeds, setProjectSeeds] = useState<ProjectSeed[]>(() =>
        readProjectRegistry()
    );
    const [activeProjectId, setActiveProjectId] = useState(() => {
        if (typeof window === "undefined") return "video-demo";
        const saved = window.localStorage.getItem(ACTIVE_PROJECT_KEY);
        return saved && projectSeeds.some((seed) => seed.id === saved)
            ? saved
            : "video-demo";
    });
    const editorStores = useRef<Map<string, VideoEditorStore>>(new Map());
    const activeSeed =
        projectSeeds.find((entry) => entry.id === activeProjectId) ??
        projectSeeds[0] ??
        PROJECT_SEEDS[0];
    const activeWorkflow = normalizeWorkflow(activeSeed.workflow);
    const editorFor = (seed: ProjectSeed) => {
        const existing = editorStores.current.get(seed.id);
        if (existing) return existing;
        const created = createProjectEditor(seed);
        editorStores.current.set(seed.id, created);
        return created;
    };
    const store = editorFor(activeSeed);
    const snapshot = useSyncExternalStore(
        store.subscribe,
        store.getSnapshot,
        store.getServerSnapshot
    );
    const { project } = snapshot;
    const shot = selectActiveShot(project);
    const shots = selectOrderedShots(project);
    const setCatalog = useMemo(
        () => selectAvailableSets(project),
        [project.sets]
    );
    const activeSetId = selectResolvedSetId(project);
    const artworks = useMemo(
        () =>
            selectArtworksForShot(project).filter((artwork) => artwork.visible),
        [activeSetId, project.artworks, project.setId]
    );
    const committedSet =
        selectSetForShot(project, project.activeShotId, setCatalog) ??
        DEMO_SET_OPTIONS[0];

    const [messages, setMessages] = useState<DirectorMessage[]>(() =>
        activeWorkflow.brief
            ? [
                  ...INITIAL_MESSAGES,
                  {
                      id: `restored-${activeSeed.id}-brief`,
                      role: "user",
                      text: activeWorkflow.brief,
                  },
                  {
                      id: `restored-${activeSeed.id}-ready`,
                      role: "assistant",
                      text: "Your saved creative brief is ready. We can generate directly or open precise 3D blocking when the shot needs it.",
                  },
              ]
            : INITIAL_MESSAGES
    );
    const [choices, setChoices] = useState<readonly SetOption[]>(() =>
        activeWorkflow.brief ? directorSetChoices(activeWorkflow.brief) : []
    );
    const [previewSetId, setPreviewSetId] = useState<string | null>(null);
    const [brief, setBrief] = useState(activeWorkflow.brief);
    const [directorDraft, setDirectorDraft] = useState("");
    const [briefingSetupOpen, setBriefingSetupOpen] = useState(false);
    const [directorActivity, setDirectorActivity] = useState<string | null>(
        null
    );
    const [directorPhase, setDirectorPhase] = useState<DirectorPhase>(() =>
        activeWorkflow.lifecycle === "draft" ? "brief" : "editing"
    );
    const [directorFocusRequest, setDirectorFocusRequest] = useState(0);
    const [workspaceSurface, setWorkspaceSurface] = useState<WorkspaceSurface>(
        () => (activeWorkflow.lifecycle === "draft" ? "conversation" : "editor")
    );
    const [selectedArtworkId, setSelectedArtworkId] = useState<string | null>(
        null
    );
    const [pathKind, setPathKind] = useState<PathKind>("position");
    const [activePathPointIndex, setActivePathPointIndex] = useState(0);
    const [viewMode, setViewMode] = useState<ViewMode>("edit");
    const [navigationMode, setNavigationMode] =
        useState<NavigationMode>("perspective");
    const [directorOpen, setDirectorOpen] = useState(true);
    const [assetOption, setAssetOption] = useState<AssetOption | null>(null);
    const [setBuilderOpen, setSetBuilderOpen] = useState(false);
    const [inspectorOpen, setInspectorOpen] = useState(false);
    const [timelineOpen, setTimelineOpen] = useState(
        () => !usesSingleOverlay()
    );
    const [currentTicks, setCurrentTicks] = useState(0);
    const [playing, setPlaying] = useState(false);
    const [toast, setToast] = useState<string | null>(null);
    const [renderJob, setRenderJob] = useState<VideoGenerationJob | null>(null);
    const [renderPending, setRenderPending] = useState(false);
    const [renderCredits, setRenderCredits] = useState<number | null>(null);
    const provider = useRef(new MockVideoProvider());
    const viewport = useRef<VideoViewportHandle>(null);
    const briefing = useRef<DirectorBriefingHandle>(null);
    const briefingProject = useRef<string | null>(null);
    const directorSessions = useRef<Map<string, DirectorSession>>(new Map());
    const generationRun = useRef(0);
    const directorRun = useRef(0);
    const directorBusy = useRef(false);
    const directorTimers = useRef<number[]>([]);
    const pendingSeek = useRef<number | null>(null);
    const reduceMotion = useReducedMotion();

    const isConversation = workspaceSurface === "conversation";
    const setBriefingHandle = useCallback(
        (handle: DirectorBriefingHandle | null) => {
            if (handle) {
                briefing.current = handle;
                briefingProject.current = activeProjectId;
                return;
            }
            if (briefingProject.current === activeProjectId) {
                briefing.current = null;
                briefingProject.current = null;
            }
        },
        [activeProjectId]
    );

    useEffect(() => {
        setBriefingSetupOpen(false);
    }, [activeProjectId, isConversation]);

    const previewSet = previewSetId
        ? findSetOption(previewSetId, setCatalog) || committedSet
        : committedSet;
    const selectedArtwork = selectedArtworkId
        ? project.artworks[selectedArtworkId] || null
        : null;
    const engineSet = useMemo(
        () => setOptionToEngine(previewSet),
        [previewSet]
    );
    const engineShot = useMemo(() => shotToEngine(shot), [shot]);
    const engineArtworks = useMemo(
        () => artworks.map(artworkToEngine),
        [artworks]
    );

    useEffect(() => {
        setCurrentTicks(pendingSeek.current ?? 0);
        pendingSeek.current = null;
        setPlaying(false);
        setPreviewSetId(null);
        setSelectedArtworkId(null);
    }, [project.activeShotId]);

    useEffect(() => {
        setActivePathPointIndex(0);
    }, [pathKind, project.activeShotId]);

    useEffect(() => {
        setCurrentTicks((value) =>
            Math.min(value, Math.max(0, shot.durationTicks - 1000))
        );
    }, [shot.durationTicks]);

    useEffect(() => {
        if (!playing) return;
        setViewMode("camera");
        let frame = 0;
        let previous = performance.now();
        const tick = (now: number) => {
            const delta = Math.min(now - previous, 100);
            previous = now;
            setCurrentTicks((value) => {
                const next = value + delta * 30;
                if (next >= shot.durationTicks - 1000) {
                    setPlaying(false);
                    return shot.durationTicks - 1000;
                }
                return next;
            });
            frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(frame);
    }, [playing, shot.durationTicks]);

    useEffect(() => {
        if (!toast) return;
        const timeout = setTimeout(() => setToast(null), 3200);
        return () => clearTimeout(timeout);
    }, [toast]);

    useEffect(
        () => () => {
            directorRun.current += 1;
            directorBusy.current = false;
            directorTimers.current.forEach((timer) =>
                window.clearTimeout(timer)
            );
            directorTimers.current = [];
            generationRun.current += 1;
        },
        []
    );

    useEffect(() => {
        const compact = window.matchMedia("(max-width: 1000px)");
        const reconcilePanels = () => {
            if (!compact.matches) return;
            if (assetOption) {
                setDirectorOpen(false);
                setInspectorOpen(false);
                setTimelineOpen(false);
            } else if (inspectorOpen || directorOpen) {
                setTimelineOpen(false);
            }
        };
        reconcilePanels();
        compact.addEventListener("change", reconcilePanels);
        return () => compact.removeEventListener("change", reconcilePanels);
    }, [assetOption, directorOpen, inspectorOpen]);

    function dispatch(operation: VideoOperation, label?: string) {
        try {
            return store.dispatch(operation, {
                expectedRevision: project.revision,
                label,
            });
        } catch (error) {
            setToast(error instanceof Error ? error.message : String(error));
            return null;
        }
    }

    function updateProjectWorkflow(
        projectId: string,
        update: (workflow: ProjectWorkflow) => ProjectWorkflow
    ) {
        setProjectSeeds((current) => {
            const next = current.map((seed) =>
                seed.id === projectId
                    ? {
                          ...seed,
                          workflow: update(normalizeWorkflow(seed.workflow)),
                      }
                    : seed
            );
            writeProjectRegistry(next);
            return next;
        });
    }

    function updateBriefingSettings(update: Partial<BriefingSettings>) {
        updateProjectWorkflow(activeProjectId, (workflow) =>
            normalizeWorkflow({
                ...workflow,
                settings: { ...workflow.settings, ...update },
            })
        );
    }

    function updateBriefingReferences(
        references: readonly BriefingReference[]
    ) {
        updateProjectWorkflow(activeProjectId, (workflow) => ({
            ...workflow,
            references: references.slice(0, 50),
            settings: {
                ...workflow.settings,
                mode:
                    references.length && workflow.settings.mode === "t2v"
                        ? "omni_reference"
                        : workflow.settings.mode,
            },
        }));
    }

    function rememberDirectorSession(projectId: string) {
        directorSessions.current.set(projectId, {
            messages,
            choices,
            brief,
            draft: directorDraft,
            phase: directorPhase,
        });
    }

    function restoredSession(seed: ProjectSeed): DirectorSession {
        const saved = directorSessions.current.get(seed.id);
        if (saved) return saved;
        const workflow = normalizeWorkflow(seed.workflow);
        if (!workflow.brief) {
            return {
                messages: INITIAL_MESSAGES,
                choices: [],
                brief: "",
                draft: "",
                phase: workflow.lifecycle === "draft" ? "brief" : "editing",
            };
        }
        return {
            messages: [
                ...INITIAL_MESSAGES,
                {
                    id: `restored-${seed.id}-brief`,
                    role: "user",
                    text: workflow.brief,
                },
                {
                    id: `restored-${seed.id}-ready`,
                    role: "assistant",
                    text: "Your brief is ready. Keep directing, generate a pass, or open a set in 3D for tighter camera control.",
                },
            ],
            choices: directorSetChoices(workflow.brief),
            brief: workflow.brief,
            draft: "",
            phase: workflow.lifecycle === "draft" ? "sets" : "editing",
        };
    }

    function enterThreeStudio(set?: SetOption) {
        if (set) setPreviewSetId(set.id);
        else if (choices[0]) setPreviewSetId(choices[0].id);
        setWorkspaceSurface(
            activeWorkflow.lifecycle === "draft" ? "preview" : "editor"
        );
        setDirectorOpen(true);
        setInspectorOpen(false);
        setAssetOption(null);
        setPlaying(false);
        setViewMode("edit");
    }

    function markProjectActive() {
        updateProjectWorkflow(activeProjectId, (workflow) => ({
            ...workflow,
            lifecycle: "active",
            brief: brief || workflow.brief,
        }));
        setWorkspaceSurface("editor");
    }

    function addMessage(role: DirectorMessage["role"], text: string) {
        setMessages((value) => [
            ...value,
            { id: makeId("message"), role, text },
        ]);
    }

    function clearDirectorTimers() {
        directorTimers.current.forEach((timer) => window.clearTimeout(timer));
        directorTimers.current = [];
    }

    function cancelDirectorReply(showToast = true) {
        directorRun.current += 1;
        directorBusy.current = false;
        clearDirectorTimers();
        setDirectorActivity(null);
        if (showToast) setToast("Director stopped");
    }

    function scheduleDirectorReply(input: {
        initial: string;
        next: string;
        complete: () => void;
    }) {
        clearDirectorTimers();
        const run = ++directorRun.current;
        directorBusy.current = true;
        setDirectorActivity(input.initial);
        directorTimers.current = [
            window.setTimeout(() => {
                if (directorRun.current === run)
                    setDirectorActivity(input.next);
            }, 360),
            window.setTimeout(() => {
                if (directorRun.current !== run) return;
                try {
                    input.complete();
                } finally {
                    directorBusy.current = false;
                    directorTimers.current = [];
                    setDirectorActivity(null);
                }
            }, 920),
        ];
    }

    function handlePrompt(prompt: string) {
        if (directorBusy.current) return;
        setDirectorOpen(true);
        setInspectorOpen(false);
        if (usesSingleOverlay()) {
            setAssetOption(null);
            setTimelineOpen(false);
        }
        addMessage("user", prompt);
        if (
            directorPhase !== "editing" &&
            project.orderedShotIds.length === 1 &&
            !snapshot.proposal
        ) {
            setBrief(prompt);
            updateProjectWorkflow(activeProjectId, (workflow) => ({
                ...workflow,
                brief: prompt,
            }));
            setChoices([]);
            scheduleDirectorReply({
                initial: "Shaping a direction",
                next: "Exploring sets and references",
                complete: () => {
                    addMessage(
                        "assistant",
                        "Here are three set directions. Generate from the brief, preview one in 3D, or keep directing."
                    );
                    setChoices(directorSetChoices(prompt));
                    setDirectorPhase("sets");
                },
            });
            return;
        }
        setChoices([]);
        setDirectorPhase("editing");
        scheduleDirectorReply({
            initial: "Reading the current sequence",
            next: "Drafting an editable camera change",
            complete: () => {
                try {
                    store.stageProposal(createRefineProposal(project, prompt));
                    addMessage(
                        "assistant",
                        "I turned that into a revision-safe camera proposal. Review it below, apply it, or keep editing by hand."
                    );
                } catch (error) {
                    setToast(
                        error instanceof Error ? error.message : String(error)
                    );
                }
            },
        });
    }

    function useSet(option: SetOption) {
        if (directorBusy.current) return;
        enterThreeStudio(option);
        setChoices([]);
        setDirectorPhase("editing");
        addMessage("user", `Block this direction in ${option.title}.`);
        scheduleDirectorReply({
            initial: "Blocking the sequence",
            next: "Checking camera lanes",
            complete: () => {
                try {
                    store.stageProposal(
                        createSequenceProposal(project, option, brief)
                    );
                    addMessage(
                        "assistant",
                        "The set and three-shot camera block are ready to review. Nothing is committed until you apply the proposal."
                    );
                } catch (error) {
                    setToast(
                        error instanceof Error ? error.message : String(error)
                    );
                }
            },
        });
    }

    function newDirectorConversation() {
        cancelDirectorReply(false);
        if (snapshot.proposal) {
            try {
                store.rejectProposal(snapshot.proposal.proposal.id);
            } catch {
                // The proposal may already have been resolved by another action.
            }
        }
        setMessages(INITIAL_MESSAGES);
        setChoices([]);
        setPreviewSetId(null);
        setBrief("");
        setDirectorDraft("");
        setDirectorPhase(
            activeWorkflow.lifecycle === "draft" ? "brief" : "editing"
        );
        setDirectorFocusRequest((value) => value + 1);
    }

    function openAssetsFromDirector() {
        setAssetOption(NftOpt);
        if (usesSingleOverlay()) {
            setDirectorOpen(false);
            setInspectorOpen(false);
            setSelectedArtworkId(null);
            setTimelineOpen(false);
        }
    }

    function activateProject(seed: ProjectSeed) {
        if (seed.id === activeProjectId) return;
        const nextEditor = editorFor(seed);
        const nextProject = nextEditor.getSnapshot().project;
        const nextWorkflow = normalizeWorkflow(seed.workflow);
        rememberDirectorSession(activeProjectId);
        const nextSession = restoredSession(seed);
        cancelDirectorReply(false);
        const outgoingProposal = store.getSnapshot().proposal;
        if (outgoingProposal) {
            try {
                store.rejectProposal(outgoingProposal.proposal.id);
            } catch {
                // It may have resolved while the switch was beginning.
            }
        }
        if (renderJob && ["queued", "running"].includes(renderJob.status)) {
            void provider.current.cancel(renderJob.id).catch(() => undefined);
        }
        generationRun.current += 1;
        setRenderPending(false);
        setRenderJob(null);
        setRenderCredits(null);
        setMessages([...nextSession.messages]);
        setChoices(nextSession.choices);
        setBrief(nextSession.brief);
        setDirectorDraft(nextSession.draft);
        setDirectorPhase(nextSession.phase);
        setPreviewSetId(null);
        setSelectedArtworkId(null);
        setInspectorOpen(false);
        setAssetOption(null);
        setSetBuilderOpen(false);
        setCurrentTicks(0);
        setPlaying(false);
        setViewMode("edit");
        setDirectorOpen(true);
        setWorkspaceSurface(
            nextWorkflow.lifecycle === "draft" ? "conversation" : "editor"
        );
        try {
            window.localStorage.setItem(ACTIVE_PROJECT_KEY, seed.id);
        } catch {
            // The registry can still be used when active selection is ephemeral.
        }
        setActiveProjectId(seed.id);
        setToast(`Switched to ${nextProject.title}`);
    }

    function switchProject(id: string) {
        const seed = projectSeeds.find((entry) => entry.id === id);
        if (seed) activateProject(seed);
    }

    function createNewProject() {
        const id = `video-${Date.now().toString(36)}`;
        const seed: ProjectSeed = {
            id,
            title: `Untitled video ${projectSeeds.length + 1}`,
            setId: DEMO_SET_OPTIONS[0].id,
            workflow: defaultWorkflow("draft"),
        };
        const next = [...projectSeeds, seed].slice(-30);
        editorStores.current.set(seed.id, createProjectEditor(seed));
        setProjectSeeds(next);
        writeProjectRegistry(next);
        activateProject(seed);
    }

    function openSetBuilder() {
        setSetBuilderOpen(true);
        setAssetOption(null);
        setInspectorOpen(false);
        setSelectedArtworkId(null);
        setPlaying(false);
    }

    function createConstructedSet(value: SetBuilderValue) {
        const suffix = Date.now().toString(36);
        const setId = `set-${suffix}`;
        const shotId = `shot-${project.orderedShotIds.length + 1}-${suffix}`;
        const set = constructProceduralSet({
            id: setId,
            ...value,
        });
        const nextShot = {
            ...createDemoShot(shotId, set.id),
            name: `${String(project.orderedShotIds.length + 1).padStart(
                2,
                "0"
            )} · ${set.title}`,
            prompt: value.direction,
        };
        try {
            store.dispatchBatch(
                [
                    {
                        type: "set.create",
                        id: makeId("create-set"),
                        source: "user",
                        set,
                    },
                    {
                        type: "shot.add",
                        id: makeId("add-set-shot"),
                        source: "user",
                        shot: nextShot,
                        afterShotId: project.activeShotId,
                    },
                ],
                {
                    expectedRevision: project.revision,
                    label: `Construct ${set.title}`,
                }
            );
            setSetBuilderOpen(false);
            setPreviewSetId(null);
            setTimelineOpen(true);
            setDirectorOpen(true);
            setViewMode("edit");
            setCurrentTicks(0);
            markProjectActive();
            addMessage(
                "assistant",
                `${set.title} is ready. I added it as shot ${
                    project.orderedShotIds.length + 1
                } in this sequence, with an independent editable camera path.`
            );
            setToast(`${set.title} added to the timeline`);
        } catch (error) {
            setToast(error instanceof Error ? error.message : String(error));
        }
    }

    function addArtwork(asset: VideoLibraryAsset) {
        const number = Object.keys(project.artworks).length + 1;
        const artwork: VideoArtwork = {
            id: makeId("artwork"),
            name: asset.name,
            setId: activeSetId,
            source:
                asset.kind === "nft"
                    ? {
                          kind: "nft",
                          uri: asset.thumbnail,
                          nft: {
                              chain: "ethereum",
                              contract: "video-studio-catalog",
                              tokenId: asset.id,
                          },
                      }
                    : { kind: "image", uri: asset.thumbnail },
            transform: {
                position: artworkPosition(activeSetId, number - 1),
                rotationDeg: [0, 0, 0],
                scale: [1, 1, 1],
            },
            protection: asset.protection,
            visible: true,
        };
        const updated = dispatch(
            {
                type: "artwork.add",
                id: makeId("add-artwork"),
                source: "user",
                artwork,
            },
            `Add ${artwork.name}`
        );
        if (updated) {
            setSelectedArtworkId(artwork.id);
            setInspectorOpen(true);
            if (usesSingleOverlay()) {
                setAssetOption(null);
                setTimelineOpen(false);
            }
            setViewMode("edit");
            setToast(
                `${artwork.name} added in ${artwork.protection} fidelity mode`
            );
        }
    }

    function addShot() {
        const id = `shot-${project.orderedShotIds.length + 1}-${Date.now()
            .toString(36)
            .slice(-4)}`;
        const next = {
            ...createDemoShot(id, activeSetId),
            name: `${String(project.orderedShotIds.length + 1).padStart(
                2,
                "0"
            )} · New shot`,
        };
        dispatch(
            {
                type: "shot.add",
                id: makeId("add-shot"),
                source: "user",
                shot: next,
                afterShotId: project.activeShotId,
            },
            "Add shot"
        );
        setSelectedArtworkId(null);
    }

    function exportGuide() {
        try {
            const manifest = createCameraManifest(project);
            const stem = `${project.id}-${shot.id}-r${project.revision}`;
            download(
                `${stem}-camera.json`,
                new Blob([JSON.stringify(manifest, null, 2)], {
                    type: "application/json",
                })
            );
            const poster = viewport.current?.capturePoster();
            if (poster) download(`${stem}-guide.webp`, poster);
            setToast(`Exported ${manifest.frameCount} deterministic frames`);
        } catch (error) {
            setToast(error instanceof Error ? error.message : String(error));
        }
    }

    async function generateShot() {
        if (
            renderPending ||
            (renderJob && ["queued", "running"].includes(renderJob.status))
        )
            return;
        const run = ++generationRun.current;
        setRenderPending(true);
        setRenderJob(null);
        setRenderCredits(null);
        setDirectorOpen(true);
        setInspectorOpen(false);
        if (usesSingleOverlay()) {
            setAssetOption(null);
            setTimelineOpen(false);
        }
        try {
            const manifest = createCameraManifest(project);
            const poster = viewport.current?.capturePoster() || "";
            const request = {
                projectId: project.id,
                projectRevision: project.revision,
                shotId: shot.id,
                modelId: "mock-reference-v1",
                resolution: "1280x720" as const,
                prompt: shot.prompt,
                guideUri: `local://guide/${fingerprint(poster)}`,
                cameraManifest: manifest,
            };
            const quote = await provider.current.quote(request);
            if (generationRun.current !== run) return;
            setRenderCredits(quote.credits);
            let job = await provider.current.submit(
                request,
                quote,
                `render-${project.id}-${shot.id}-${project.revision}-${run}`
            );
            if (generationRun.current !== run) {
                await provider.current.cancel(job.id);
                return;
            }
            setRenderJob(job);
            setRenderPending(false);
            addMessage(
                "assistant",
                `The guide bundle is locked to revision ${project.revision}. I reserved ${quote.credits} demo credits and submitted the selected shot.`
            );
            for (const progress of [0.12, 0.33, 0.61, 0.84, 1]) {
                await new Promise((resolve) => setTimeout(resolve, 480));
                if (generationRun.current !== run) return;
                job = await provider.current.advanceJob(job.id, progress);
                setRenderJob(job);
            }
        } catch (error) {
            if (generationRun.current === run) {
                setToast(
                    error instanceof Error ? error.message : String(error)
                );
            }
        } finally {
            if (generationRun.current === run) setRenderPending(false);
        }
    }

    function addBriefingReferences(files: readonly File[]) {
        const accepted: BriefingReference[] = [];
        for (const file of files) {
            const kind = file.type.startsWith("image/")
                ? "image"
                : file.type.startsWith("video/")
                ? "video"
                : file.type.startsWith("audio/")
                ? "audio"
                : null;
            if (!kind) continue;
            if (file.size > 20 * 1024 * 1024) {
                setToast(`${file.name} is larger than the 20 MB upload limit`);
                continue;
            }
            accepted.push({
                id: makeId("reference"),
                name: file.name.slice(0, 160),
                kind,
                size: file.size,
            });
        }
        if (!accepted.length) return;
        updateBriefingReferences([...activeWorkflow.references, ...accepted]);
    }

    function removeBriefingReference(id: string) {
        updateBriefingReferences(
            activeWorkflow.references.filter((reference) => reference.id !== id)
        );
    }

    function shouldUseThreeGuide() {
        if (activeWorkflow.settings.guideMode === "3d") return true;
        if (activeWorkflow.settings.guideMode === "none") return false;
        return /\b(exact camera|camera path|orbit|choreograph|blocking|spatial continuity|match move)\b/i.test(
            brief
        );
    }

    async function generateFirstPass() {
        if (!brief.trim() || renderBusy) return;
        if (shouldUseThreeGuide()) {
            addMessage(
                "assistant",
                "This direction asks for precise spatial or camera continuity, so I’m opening an editable 3D block before spending generation credits."
            );
            enterThreeStudio();
            return;
        }
        const run = ++generationRun.current;
        const settings = activeWorkflow.settings;
        const references = activeWorkflow.references;
        const mode =
            references.length && settings.mode === "t2v"
                ? "omni_reference"
                : settings.mode;
        const sourceVideoId = references.find(
            (reference) => reference.kind === "video"
        )?.id;
        setRenderPending(true);
        setRenderJob(null);
        setRenderCredits(null);
        try {
            const request = {
                projectId: project.id,
                projectRevision: project.revision,
                shotId: shot.id,
                modelId: settings.modelId,
                mode,
                durationSeconds: settings.durationSeconds,
                aspectRatio: settings.aspectRatio,
                resolution: settings.resolution,
                generateAudio: settings.generateAudio,
                bitrateMode: "standard" as const,
                prompt: compileSeedancePrompt(brief, settings, references),
                mediaReferences: references.map((reference) => ({
                    id: reference.id,
                    uri: `local://reference/${reference.id}`,
                    kind: reference.kind,
                    role:
                        reference.kind === "audio"
                            ? ("audio" as const)
                            : reference.id === sourceVideoId &&
                              ["video_edit", "video_extension"].includes(mode)
                            ? ("source" as const)
                            : reference.kind === "video"
                            ? ("motion" as const)
                            : ("subject" as const),
                    label: reference.name,
                })),
            };
            const quote = await provider.current.quote(request);
            if (generationRun.current !== run) return;
            setRenderCredits(quote.credits);
            let job = await provider.current.submit(
                request,
                quote,
                `brief-${project.id}-${project.revision}-${run}`
            );
            if (generationRun.current !== run) {
                await provider.current.cancel(job.id);
                return;
            }
            setRenderJob(job);
            setRenderPending(false);
            for (const progress of [0.1, 0.28, 0.53, 0.78, 1]) {
                await new Promise((resolve) => setTimeout(resolve, 480));
                if (generationRun.current !== run) return;
                job = await provider.current.advanceJob(job.id, progress);
                setRenderJob(job);
            }
            addMessage(
                "assistant",
                "First pass is ready. Tell me what you want to change, or block the camera in 3D for tighter control."
            );
        } catch (error) {
            if (generationRun.current === run) {
                setToast(
                    error instanceof Error ? error.message : String(error)
                );
            }
        } finally {
            if (generationRun.current === run) setRenderPending(false);
        }
    }

    async function cancelRender() {
        const run = ++generationRun.current;
        setRenderPending(false);
        if (!renderJob || !["queued", "running"].includes(renderJob.status)) {
            setToast("Generation stopped before submission");
            return;
        }
        try {
            const cancelled = await provider.current.cancel(renderJob.id);
            if (generationRun.current !== run) return;
            setRenderJob(cancelled);
            addMessage(
                "assistant",
                workspaceSurface === "conversation"
                    ? "Stopped the render. Your brief, settings and references are unchanged."
                    : "Stopped the render. Your Three.js guide and scene edits are unchanged."
            );
        } catch (error) {
            if (generationRun.current === run)
                setToast(
                    error instanceof Error ? error.message : String(error)
                );
        }
    }

    const normalizedTime = Math.max(
        0,
        Math.min(1, currentTicks / Math.max(1, shot.durationTicks - 1000))
    );
    const renderBusy =
        renderPending ||
        !!(renderJob && ["queued", "running"].includes(renderJob.status));
    const hasBriefingDirection = Boolean(brief.trim()) && choices.length > 0;
    const briefingActionsBusy = directorActivity !== null || renderBusy;
    const briefingEstimate = estimateSeedanceCredits(activeWorkflow.settings);

    function undo() {
        try {
            store.undo(project.revision);
        } catch (error) {
            setToast(error instanceof Error ? error.message : String(error));
        }
    }

    function redo() {
        try {
            store.redo(project.revision);
        } catch (error) {
            setToast(error instanceof Error ? error.message : String(error));
        }
    }

    function openCameraInspector() {
        setSelectedArtworkId(null);
        setInspectorOpen(true);
        if (usesSingleOverlay()) {
            setAssetOption(null);
            setTimelineOpen(false);
        }
        setViewMode("edit");
        setPlaying(false);
    }

    function toggleDirector() {
        const opening = inspectorOpen || !directorOpen;
        setInspectorOpen(false);
        setSelectedArtworkId(null);
        setDirectorOpen(opening);
        if (opening) setDirectorFocusRequest((value) => value + 1);
        if (opening && usesSingleOverlay()) {
            setAssetOption(null);
            setTimelineOpen(false);
        }
    }

    function toggleTimeline() {
        const opening = !timelineOpen;
        setTimelineOpen(opening);
        if (opening && usesSingleOverlay()) {
            setDirectorOpen(false);
            setAssetOption(null);
            setInspectorOpen(false);
            setSelectedArtworkId(null);
        }
    }

    function selectArtwork(id: string) {
        setSelectedArtworkId(id);
        setInspectorOpen(true);
        setViewMode("edit");
        setPlaying(false);
        if (usesSingleOverlay()) {
            setAssetOption(null);
            setTimelineOpen(false);
        }
    }

    const rightRailOpen = directorOpen || inspectorOpen;
    const projectSummaries: readonly VideoProjectSummary[] = projectSeeds.map(
        (seed) => {
            const summaryProject =
                seed.id === activeProjectId
                    ? project
                    : editorFor(seed).getSnapshot().project;
            const summaryCatalog = selectAvailableSets(summaryProject);
            const summarySet =
                selectSetForShot(
                    summaryProject,
                    summaryProject.activeShotId,
                    summaryCatalog
                ) ?? DEMO_SET_OPTIONS[0];
            return {
                id: summaryProject.id,
                title: summaryProject.title,
                setTitle:
                    normalizeWorkflow(seed.workflow).lifecycle === "draft"
                        ? "Creative brief"
                        : summarySet.title,
                shotCount:
                    normalizeWorkflow(seed.workflow).lifecycle === "draft"
                        ? 0
                        : summaryProject.orderedShotIds.length,
                revision: summaryProject.revision,
                palette: summarySet.palette,
            };
        }
    );

    return (
        <main className={styles.app} data-studio-surface>
            <StudioTheme />
            <StudioToolbarFrame isAnonymous={false} className="edit">
                <div className="horz left">
                    <div className={styles.brandButton}>
                        <OncyberLockup />
                    </div>
                </div>
                <div className="horz center">
                    <ProjectSwitcher
                        projects={projectSummaries}
                        activeProjectId={activeProjectId}
                        onSelect={switchProject}
                        onCreateProject={createNewProject}
                        onConstructSet={openSetBuilder}
                    />
                </div>
                <div className="horz right">
                    <span className={styles.creditBalance}>840 cr</span>
                    {isConversation ? (
                        <>
                            <ToolbarButton
                                className={styles.toolbarSecondaryAction}
                                aria-label="Focus the Director composer"
                                title="Director"
                                onClick={() =>
                                    briefing.current?.focusComposer()
                                }
                            >
                                <ComposeIcon />
                            </ToolbarButton>
                            <ToolbarButton
                                className={styles.toolbarSecondaryAction}
                                aria-label={
                                    activeWorkflow.references.length
                                        ? `Attach more references; ${activeWorkflow.references.length} already attached`
                                        : "Attach image, video or audio references"
                                }
                                title="References"
                                onClick={() =>
                                    briefing.current?.attachReferences()
                                }
                            >
                                <ImageIcon />
                            </ToolbarButton>
                            <ToolbarButton
                                className={styles.toolbarSecondaryAction}
                                aria-label={
                                    briefingSetupOpen
                                        ? "Close video setup"
                                        : "Open video setup"
                                }
                                aria-expanded={briefingSetupOpen}
                                aria-controls="briefing-video-settings"
                                title={`Video setup · ${activeWorkflow.settings.durationSeconds}s · ${activeWorkflow.settings.aspectRatio} · ${activeWorkflow.settings.resolution}`}
                                toggled={briefingSetupOpen}
                                onClick={() =>
                                    briefing.current?.toggleVideoSetup()
                                }
                            >
                                <FilmIcon />
                            </ToolbarButton>
                            {hasBriefingDirection ? (
                                <>
                                    <ToolbarButton
                                        aria-label="Open optional 3D camera blocking"
                                        title="Block in 3D"
                                        onClick={() => enterThreeStudio()}
                                        disabled={briefingActionsBusy}
                                    >
                                        <CameraIcon />
                                    </ToolbarButton>
                                    <ToolbarButton
                                        className={styles.generateButton}
                                        hasLabel
                                        $primary
                                        aria-label={
                                            renderBusy
                                                ? "Rendering first pass"
                                                : renderJob?.status ===
                                                  "succeeded"
                                                ? `Generate another first pass for ${briefingEstimate} credits`
                                                : `Generate first pass for ${briefingEstimate} credits`
                                        }
                                        onClick={generateFirstPass}
                                        disabled={briefingActionsBusy}
                                    >
                                        <SparklesIcon />
                                        <ToolbarButtonLabel
                                            className={styles.generateLabel}
                                        >
                                            {renderBusy
                                                ? "Rendering…"
                                                : renderJob?.status ===
                                                  "succeeded"
                                                ? `Generate again · ${briefingEstimate} cr`
                                                : `Generate · ${briefingEstimate} cr`}
                                        </ToolbarButtonLabel>
                                    </ToolbarButton>
                                </>
                            ) : null}
                        </>
                    ) : (
                        <>
                            <ToolbarButton
                                className={styles.toolbarSecondaryAction}
                                aria-label="Undo"
                                title="Undo"
                                onClick={undo}
                                disabled={!snapshot.canUndo}
                            >
                                <UndoIcon />
                            </ToolbarButton>
                            <ToolbarButton
                                className={styles.toolbarSecondaryAction}
                                aria-label="Redo"
                                title="Redo"
                                onClick={redo}
                                disabled={!snapshot.canRedo}
                            >
                                <RedoIcon />
                            </ToolbarButton>
                            <ToolbarButton
                                aria-label={
                                    inspectorOpen || !directorOpen
                                        ? "Open Director"
                                        : "Close Director"
                                }
                                aria-pressed={directorOpen && !inspectorOpen}
                                title="Director"
                                toggled={directorOpen && !inspectorOpen}
                                onClick={toggleDirector}
                            >
                                <SparklesIcon />
                            </ToolbarButton>
                            <ToolbarButton
                                aria-label={
                                    timelineOpen
                                        ? "Close timeline"
                                        : "Open timeline"
                                }
                                aria-pressed={timelineOpen}
                                title="Shots"
                                toggled={timelineOpen}
                                onClick={toggleTimeline}
                            >
                                <FilmIcon />
                            </ToolbarButton>
                            <ToolbarButton
                                className={styles.toolbarSecondaryAction}
                                aria-label="Export guide"
                                title="Export guide"
                                onClick={exportGuide}
                            >
                                <DownloadIcon />
                            </ToolbarButton>
                            {activeWorkflow.lifecycle !== "draft" ? (
                                <ToolbarButton
                                    className={styles.generateButton}
                                    hasLabel
                                    $primary
                                    aria-label={
                                        renderBusy
                                            ? "Rendering selected shot"
                                            : "Generate selected shot"
                                    }
                                    onClick={generateShot}
                                    disabled={renderBusy}
                                >
                                    <SparklesIcon />
                                    <ToolbarButtonLabel
                                        className={styles.generateLabel}
                                    >
                                        {renderBusy ? "Rendering" : "Generate"}
                                    </ToolbarButtonLabel>
                                </ToolbarButton>
                            ) : null}
                        </>
                    )}
                </div>
            </StudioToolbarFrame>

            <AnimatePresence mode="sync" initial={false}>
                {isConversation ? (
                    <DirectorBriefing
                        ref={setBriefingHandle}
                        key={`briefing-${activeProjectId}`}
                        messages={messages}
                        choices={choices}
                        previewSetId={previewSetId}
                        selectedSetId={
                            activeWorkflow.lifecycle === "draft"
                                ? null
                                : activeSetId
                        }
                        draft={directorDraft}
                        activity={directorActivity}
                        settings={activeWorkflow.settings}
                        references={activeWorkflow.references}
                        renderPending={renderPending}
                        renderJob={renderJob}
                        renderCredits={renderCredits}
                        onDraftChange={setDirectorDraft}
                        onSettingsChange={(settings) =>
                            updateBriefingSettings(settings)
                        }
                        onVideoSetupOpenChange={setBriefingSetupOpen}
                        onAddReferences={addBriefingReferences}
                        onRemoveReference={removeBriefingReference}
                        onPreviewSet={(set) => enterThreeStudio(set)}
                        onUseSet={useSet}
                        onSubmit={handlePrompt}
                        onCancelReply={cancelDirectorReply}
                        onCancelRender={cancelRender}
                        onRetryRender={generateFirstPass}
                    />
                ) : (
                    <motion.div
                        key={`editor-${activeProjectId}`}
                        className={styles.editorStage}
                        initial={reduceMotion ? false : { opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={reduceMotion ? undefined : { opacity: 0 }}
                        transition={{ duration: reduceMotion ? 0 : 0.18 }}
                    >
                        <StudioSceneFrame
                            className={styles.sceneFrame}
                            data-right-rail-open={rightRailOpen || undefined}
                        >
                            <div className={styles.canvasPane}>
                                <VideoViewport
                                    ref={viewport}
                                    set={engineSet}
                                    shot={engineShot}
                                    artworks={engineArtworks}
                                    mode={viewMode}
                                    navigationMode={navigationMode}
                                    pathKind={pathKind}
                                    activePathPointIndex={activePathPointIndex}
                                    normalizedTime={normalizedTime}
                                    onPathPointCommit={(
                                        spline,
                                        index,
                                        point
                                    ) => {
                                        dispatch(
                                            {
                                                type: "camera.point.move",
                                                id: makeId("move-camera-point"),
                                                source: "user",
                                                shotId: shot.id,
                                                spline,
                                                index,
                                                point,
                                            },
                                            `Edit ${spline} spline`
                                        );
                                    }}
                                    onPathPointSelect={(spline, index) => {
                                        setPathKind(spline);
                                        setActivePathPointIndex(index);
                                    }}
                                    onSelectArtwork={selectArtwork}
                                />

                                <div className={styles.viewToggle}>
                                    <button
                                        type="button"
                                        data-active={
                                            viewMode === "edit" || undefined
                                        }
                                        aria-pressed={viewMode === "edit"}
                                        onClick={() => {
                                            setViewMode("edit");
                                            setPlaying(false);
                                        }}
                                    >
                                        <PathIcon /> Edit path
                                    </button>
                                    <button
                                        type="button"
                                        data-active={
                                            viewMode === "camera" || undefined
                                        }
                                        aria-pressed={viewMode === "camera"}
                                        onClick={() => setViewMode("camera")}
                                    >
                                        <FilmIcon /> Shot camera
                                    </button>
                                    <button
                                        type="button"
                                        data-active={
                                            (inspectorOpen &&
                                                !selectedArtwork) ||
                                            undefined
                                        }
                                        aria-pressed={
                                            inspectorOpen && !selectedArtwork
                                        }
                                        onClick={openCameraInspector}
                                    >
                                        <CameraIcon /> Camera setup
                                    </button>
                                </div>

                                {previewSetId &&
                                previewSetId !== activeSetId ? (
                                    <div className={styles.previewNotice}>
                                        <span>
                                            Previewing {previewSet.title}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setPreviewSetId(null);
                                                if (
                                                    activeWorkflow.lifecycle ===
                                                    "draft"
                                                )
                                                    setWorkspaceSurface(
                                                        "conversation"
                                                    );
                                            }}
                                        >
                                            {activeWorkflow.lifecycle ===
                                            "draft"
                                                ? "Back to directions"
                                                : "Return to project"}
                                        </button>
                                    </div>
                                ) : null}

                                <div
                                    className={styles.viewportMeta}
                                    data-timeline-open={
                                        timelineOpen || undefined
                                    }
                                >
                                    <span>
                                        {viewMode === "edit" ? (
                                            <>
                                                <i data-color={pathKind} /> Drag{" "}
                                                {pathKind === "position"
                                                    ? "camera"
                                                    : "look-at"}{" "}
                                                points
                                            </>
                                        ) : (
                                            <>
                                                <FilmIcon /> Shot output · 16:9
                                            </>
                                        )}
                                    </span>
                                    <span>
                                        {previewSet.title} ·{" "}
                                        {shot.camera.focalLengthMm} mm
                                    </span>
                                </div>

                                {viewMode === "edit" ? (
                                    <div
                                        className={styles.navigationCluster}
                                        data-timeline-open={
                                            timelineOpen || undefined
                                        }
                                    >
                                        <div
                                            className={styles.navigationToggle}
                                        >
                                            <button
                                                type="button"
                                                data-active={
                                                    navigationMode ===
                                                        "perspective" ||
                                                    undefined
                                                }
                                                aria-pressed={
                                                    navigationMode ===
                                                    "perspective"
                                                }
                                                onClick={() =>
                                                    setNavigationMode(
                                                        "perspective"
                                                    )
                                                }
                                            >
                                                <CameraIcon />
                                                <span>Perspective</span>
                                            </button>
                                            <button
                                                type="button"
                                                data-active={
                                                    navigationMode === "map" ||
                                                    undefined
                                                }
                                                aria-pressed={
                                                    navigationMode === "map"
                                                }
                                                onClick={() =>
                                                    setNavigationMode("map")
                                                }
                                            >
                                                <MapIcon />
                                                <span>Map view</span>
                                            </button>
                                        </div>
                                        <p className={styles.navigationHelp}>
                                            {navigationMode === "map"
                                                ? "Drag to pan · Shift-drag to look · Scroll to zoom · WASD/arrows to move"
                                                : "Drag to look · Shift-drag to move · Scroll to zoom · WASD/arrows to move · Space/B for height · Click floor to move"}
                                        </p>
                                    </div>
                                ) : null}

                                {timelineOpen ? (
                                    <Timeline
                                        shots={shots}
                                        sets={setCatalog}
                                        defaultSetId={project.setId}
                                        activeShotId={project.activeShotId}
                                        currentTicks={currentTicks}
                                        playing={playing}
                                        canUndo={snapshot.canUndo}
                                        canRedo={snapshot.canRedo}
                                        onTogglePlay={() => {
                                            if (
                                                currentTicks >=
                                                shot.durationTicks - 1000
                                            )
                                                setCurrentTicks(0);
                                            setPlaying((value) => !value);
                                        }}
                                        onSeekGlobal={(shotId, ticks) => {
                                            if (
                                                shotId !== project.activeShotId
                                            ) {
                                                pendingSeek.current = ticks;
                                                dispatch({
                                                    type: "shot.activate",
                                                    id: makeId("activate-shot"),
                                                    source: "user",
                                                    shotId,
                                                });
                                                setSelectedArtworkId(null);
                                            } else {
                                                setCurrentTicks(ticks);
                                            }
                                            setPlaying(false);
                                        }}
                                        onActivate={(shotId) => {
                                            if (shotId === project.activeShotId)
                                                return;
                                            dispatch({
                                                type: "shot.activate",
                                                id: makeId("activate-shot"),
                                                source: "user",
                                                shotId,
                                            });
                                            setSelectedArtworkId(null);
                                        }}
                                        onUndo={undo}
                                        onRedo={redo}
                                        onExport={exportGuide}
                                        onAddShot={addShot}
                                        onClose={() => setTimelineOpen(false)}
                                    />
                                ) : null}

                                {toast ? (
                                    <div className={styles.toast} role="status">
                                        <CheckIcon /> {toast}
                                    </div>
                                ) : null}
                            </div>

                            {rightRailOpen ? (
                                <div
                                    className={styles.rightRail}
                                    data-panel={
                                        inspectorOpen ? "inspector" : "director"
                                    }
                                >
                                    {inspectorOpen ? (
                                        <Inspector
                                            project={project}
                                            shot={shot}
                                            artwork={selectedArtwork}
                                            pathKind={pathKind}
                                            activePointIndex={
                                                activePathPointIndex
                                            }
                                            onPathKind={(kind) => {
                                                setPathKind(kind);
                                                setViewMode("edit");
                                            }}
                                            onActivePointIndex={
                                                setActivePathPointIndex
                                            }
                                            onClose={() => {
                                                setInspectorOpen(false);
                                                setSelectedArtworkId(null);
                                            }}
                                            dispatch={dispatch}
                                        />
                                    ) : (
                                        <DirectorChat
                                            messages={messages}
                                            choices={choices}
                                            previewSetId={previewSetId}
                                            selectedSetId={
                                                activeWorkflow.lifecycle ===
                                                "draft"
                                                    ? null
                                                    : activeSetId
                                            }
                                            proposal={snapshot.proposal}
                                            renderJob={renderJob}
                                            renderPending={renderPending}
                                            renderCredits={renderCredits}
                                            draft={directorDraft}
                                            activity={directorActivity}
                                            focusRequest={directorFocusRequest}
                                            onDraftChange={setDirectorDraft}
                                            onPreviewSet={(set) => {
                                                setPreviewSetId(set.id);
                                                setViewMode("edit");
                                            }}
                                            onUseSet={useSet}
                                            onApplyProposal={(proposal) => {
                                                try {
                                                    store.applyProposal(
                                                        proposal.id,
                                                        project.revision
                                                    );
                                                    addMessage(
                                                        "assistant",
                                                        "Applied. Every shot is now editable, and your next manual change stays authoritative."
                                                    );
                                                    setPreviewSetId(null);
                                                    markProjectActive();
                                                } catch (error) {
                                                    setToast(
                                                        error instanceof Error
                                                            ? error.message
                                                            : String(error)
                                                    );
                                                }
                                            }}
                                            onRejectProposal={(proposal) => {
                                                store.rejectProposal(
                                                    proposal.id
                                                );
                                                addMessage(
                                                    "assistant",
                                                    "Rejected. Nothing in the project was changed."
                                                );
                                                setPreviewSetId(null);
                                                if (
                                                    activeWorkflow.lifecycle ===
                                                    "draft"
                                                ) {
                                                    setChoices(
                                                        directorSetChoices(
                                                            brief
                                                        )
                                                    );
                                                    setDirectorPhase("sets");
                                                    setWorkspaceSurface(
                                                        "conversation"
                                                    );
                                                }
                                            }}
                                            onSubmit={handlePrompt}
                                            onCancelReply={cancelDirectorReply}
                                            onNewConversation={
                                                newDirectorConversation
                                            }
                                            onOpenAssets={
                                                openAssetsFromDirector
                                            }
                                            onCancelRender={cancelRender}
                                            onRetryRender={generateShot}
                                            onClose={() => {
                                                if (
                                                    activeWorkflow.lifecycle ===
                                                    "draft"
                                                ) {
                                                    setPreviewSetId(null);
                                                    setWorkspaceSurface(
                                                        "conversation"
                                                    );
                                                } else {
                                                    setDirectorOpen(false);
                                                }
                                            }}
                                        />
                                    )}
                                </div>
                            ) : null}
                        </StudioSceneFrame>
                    </motion.div>
                )}
            </AnimatePresence>

            {isConversation && toast ? (
                <div className={styles.toast} role="status">
                    <CheckIcon /> {toast}
                </div>
            ) : null}

            <SetBuilder
                open={setBuilderOpen}
                nextShotNumber={project.orderedShotIds.length + 1}
                onCreate={createConstructedSet}
                onClose={() => setSetBuilderOpen(false)}
            />

            {!isConversation ? (
                <StudioAssetDock
                    option={assetOption}
                    onOptionChange={(option) => {
                        setAssetOption(option);
                        if (option && usesSingleOverlay()) {
                            setDirectorOpen(false);
                            setInspectorOpen(false);
                            setSelectedArtworkId(null);
                            setTimelineOpen(false);
                        }
                    }}
                >
                    {assetOption ? (
                        <VideoAssetLibrary
                            option={assetOption}
                            artworks={selectArtworksForShot(project)}
                            sets={setCatalog}
                            selectedArtworkId={selectedArtworkId}
                            selectedSetId={activeSetId}
                            onAddAsset={addArtwork}
                            onSelectArtwork={selectArtwork}
                            onPreviewSet={(set) => {
                                setPreviewSetId(set.id);
                                setViewMode("edit");
                            }}
                            onUseSet={useSet}
                        />
                    ) : null}
                </StudioAssetDock>
            ) : null}
        </main>
    );
}
