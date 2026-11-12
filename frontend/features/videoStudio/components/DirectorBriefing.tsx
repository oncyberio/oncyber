import {
    forwardRef,
    useEffect,
    useImperativeHandle,
    useLayoutEffect,
    useRef,
    useState,
    type FormEvent,
} from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { VideoGenerationJob } from "../guide";
import type { SetOption } from "../model";
import styles from "../VideoStudioShell.module.css";
import {
    ArrowUpIcon,
    CameraIcon,
    ChevronDownIcon,
    CloseIcon,
    FilmIcon,
    ImageIcon,
    PlusIcon,
    SparklesIcon,
    StopIcon,
} from "./Icons";
import { SetChoiceCard } from "./SetChoiceCard";

export type DirectorBriefingMode =
    | "t2v"
    | "omni_reference"
    | "video_edit"
    | "video_extension";

export type DirectorBriefingAspectRatio =
    | "auto"
    | "16:9"
    | "9:16"
    | "1:1"
    | "4:3"
    | "3:4"
    | "21:9";

export type DirectorBriefingResolution = "480p" | "720p" | "1080p";
export type DirectorBriefingGuideMode = "auto" | "none" | "3d";
export type DirectorBriefingReferenceKind = "image" | "video" | "audio";

export interface DirectorBriefingSettings {
    readonly modelId: "seedance_2_5";
    readonly mode: DirectorBriefingMode;
    readonly durationSeconds: number;
    readonly aspectRatio: DirectorBriefingAspectRatio;
    readonly resolution: DirectorBriefingResolution;
    readonly generateAudio: boolean;
    readonly guideMode: DirectorBriefingGuideMode;
}

export interface DirectorBriefingReference {
    readonly id: string;
    readonly name: string;
    readonly kind: DirectorBriefingReferenceKind;
    readonly size?: number;
}

export interface DirectorBriefingMessage {
    readonly id: string;
    readonly role: "assistant" | "user";
    readonly text: string;
}

export interface DirectorBriefingProps {
    readonly messages: readonly DirectorBriefingMessage[];
    readonly choices: readonly SetOption[];
    readonly previewSetId: string | null;
    readonly selectedSetId: string | null;
    readonly draft: string;
    readonly activity: string | null;
    readonly settings: DirectorBriefingSettings;
    readonly references: readonly DirectorBriefingReference[];
    readonly renderPending: boolean;
    readonly renderJob: VideoGenerationJob | null;
    readonly renderCredits: number | null;
    readonly onDraftChange: (value: string) => void;
    readonly onSettingsChange: (settings: DirectorBriefingSettings) => void;
    readonly onVideoSetupOpenChange: (open: boolean) => void;
    readonly onAddReferences: (files: readonly File[]) => void;
    readonly onRemoveReference: (id: string) => void;
    readonly onPreviewSet: (set: SetOption) => void;
    readonly onUseSet: (set: SetOption) => void;
    readonly onSubmit: (prompt: string) => void;
    readonly onCancelReply: () => void;
    readonly onCancelRender: () => void;
    readonly onRetryRender: () => void;
}

export interface DirectorBriefingHandle {
    readonly focusComposer: () => void;
    readonly attachReferences: () => void;
    readonly toggleVideoSetup: () => void;
}

const QUICK_STARTS = [
    {
        title: "Launch a collection",
        detail: "A tactile, cinematic reveal with three distinct beats",
        prompt: "Create a cinematic launch film for a new digital art collection. Start intimate, reveal the full space, then end on the hero artwork.",
        icon: SparklesIcon,
    },
    {
        title: "Build an impossible world",
        detail: "Explore a visual direction before opening the 3D set",
        prompt: "Design a dreamlike architectural world for a short film. Make the camera feel precise while the environment becomes progressively impossible.",
        icon: CameraIcon,
    },
    {
        title: "Transform existing footage",
        detail: "Keep the timing and motion, restyle the world around it",
        prompt: "I have reference footage to transform. Preserve its motion, framing and timing while we develop a new art direction.",
        icon: FilmIcon,
    },
] as const;

const MODE_OPTIONS: readonly {
    value: DirectorBriefingMode;
    label: string;
}[] = [
    { value: "t2v", label: "Text to video" },
    { value: "omni_reference", label: "References" },
    { value: "video_edit", label: "Edit video" },
    { value: "video_extension", label: "Extend video" },
];

const ASPECT_RATIOS: readonly DirectorBriefingAspectRatio[] = [
    "auto",
    "16:9",
    "9:16",
    "1:1",
    "4:3",
    "3:4",
    "21:9",
];

const RESOLUTIONS: readonly DirectorBriefingResolution[] = [
    "480p",
    "720p",
    "1080p",
];

const GUIDE_OPTIONS: readonly {
    value: DirectorBriefingGuideMode;
    label: string;
}[] = [
    { value: "auto", label: "Guide: Auto" },
    { value: "none", label: "Guide: None" },
    { value: "3d", label: "Guide: 3D" },
];

function formatSize(size?: number) {
    if (!size) return null;
    if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function referenceIcon(kind: DirectorBriefingReferenceKind) {
    if (kind === "image") return <ImageIcon />;
    if (kind === "video") return <FilmIcon />;
    return <span aria-hidden="true">♪</span>;
}

function jobTitle(job: VideoGenerationJob | null, pending: boolean) {
    if (pending && !job) return "Preparing the first pass";
    if (!job) return "Preparing the first pass";
    if (job.status === "succeeded") return "First pass ready";
    if (job.status === "failed") return "Generation failed";
    if (job.status === "cancelled") return "Generation stopped";
    if (job.status === "queued") return "Queued with Seedance";
    return "Generating the first pass";
}

function jobDescription(job: VideoGenerationJob | null) {
    if (!job) return "Compiling the brief, references and generation settings.";
    if (job.status === "succeeded")
        return "Review this pass, then describe a change or open 3D for tighter control.";
    if (job.status === "failed")
        return job.error || "The renderer could not complete this pass.";
    if (job.status === "cancelled")
        return "This attempt was stopped. Your brief and references are still here.";
    return `${Math.round(
        job.progress * 100
    )}% · You can keep refining the brief while this runs.`;
}

export const DirectorBriefing = forwardRef<
    DirectorBriefingHandle,
    DirectorBriefingProps
>(function DirectorBriefing(
    {
        messages,
        choices,
        previewSetId,
        selectedSetId,
        draft,
        activity,
        settings,
        references,
        renderPending,
        renderJob,
        renderCredits,
        onDraftChange,
        onSettingsChange,
        onVideoSetupOpenChange,
        onAddReferences,
        onRemoveReference,
        onPreviewSet,
        onUseSet,
        onSubmit,
        onCancelReply,
        onCancelRender,
        onRetryRender,
    },
    ref
) {
    const reduceMotion = useReducedMotion();
    const [settingsOpen, setSettingsOpen] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const followLatestRef = useRef(true);
    const visibleMessages = messages.filter(
        (message) => message.id !== "welcome"
    );
    const hasConversationMessages = messages.some(
        (message) => message.role === "user" || message.id !== "welcome"
    );
    const empty = !hasConversationMessages && choices.length === 0;
    const busy = activity !== null;
    const rendering =
        renderPending ||
        (!!renderJob && ["queued", "running"].includes(renderJob.status));
    const showRender = renderPending || renderJob !== null;
    const settingsSummary = `${settings.durationSeconds}s · ${settings.aspectRatio} · ${settings.resolution}`;

    useImperativeHandle(
        ref,
        () => ({
            focusComposer() {
                followLatestRef.current = true;
                textareaRef.current?.focus();
            },
            attachReferences() {
                fileInputRef.current?.click();
            },
            toggleVideoSetup() {
                followLatestRef.current = true;
                setSettingsOpen((value) => !value);
            },
        }),
        []
    );

    useLayoutEffect(() => {
        const textarea = textareaRef.current;
        if (!textarea) return;
        textarea.style.height = "0px";
        textarea.style.height = `${Math.min(textarea.scrollHeight, 180)}px`;
    }, [draft]);

    useEffect(() => {
        if (
            empty &&
            window.matchMedia(
                "(hover: hover) and (pointer: fine) and (min-width: 601px)"
            ).matches
        )
            textareaRef.current?.focus();
    }, [empty]);

    useEffect(() => {
        onVideoSetupOpenChange(settingsOpen);
    }, [onVideoSetupOpenChange, settingsOpen]);

    useEffect(() => {
        const node = scrollRef.current;
        if (!node || empty || !followLatestRef.current) return;
        const frame = window.requestAnimationFrame(() => {
            node.scrollTo({
                top: node.scrollHeight,
                behavior: reduceMotion ? "auto" : "smooth",
            });
        });
        return () => window.cancelAnimationFrame(frame);
    }, [
        activity,
        choices.length,
        empty,
        messages.length,
        renderJob?.status,
        renderPending,
        reduceMotion,
        settingsOpen,
    ]);

    const updateSettings = <Key extends keyof DirectorBriefingSettings>(
        key: Key,
        value: DirectorBriefingSettings[Key]
    ) => onSettingsChange({ ...settings, [key]: value });

    const submit = () => {
        const prompt = draft.trim();
        if (!prompt || busy) return;
        followLatestRef.current = true;
        onDraftChange("");
        onSubmit(prompt);
    };

    const handleSubmit = (event: FormEvent) => {
        event.preventDefault();
        submit();
    };

    const transition = { duration: reduceMotion ? 0 : 0.18 };
    const enter = reduceMotion ? false : { opacity: 0, y: 6 };

    return (
        <motion.section
            className={styles.briefingPage}
            data-empty={empty || undefined}
            aria-label="AI video briefing"
            aria-busy={busy || renderPending}
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={reduceMotion ? undefined : { opacity: 0, x: 24 }}
            transition={transition}
        >
            <div
                ref={scrollRef}
                className={styles.briefingViewport}
                onScroll={(event) => {
                    const node = event.currentTarget;
                    followLatestRef.current =
                        node.scrollHeight - node.scrollTop - node.clientHeight <
                        96;
                }}
            >
                <div className={styles.briefingContent}>
                    <AnimatePresence initial={false}>
                        {empty ? (
                            <motion.div
                                key="briefing-hero"
                                className={styles.briefingHero}
                                initial={enter}
                                animate={{ opacity: 1, y: 0 }}
                                exit={
                                    reduceMotion
                                        ? undefined
                                        : { opacity: 0, y: -8 }
                                }
                                transition={transition}
                            >
                                <h1>What do you want to make?</h1>
                                <p>
                                    Describe an idea or drop in a reference.
                                    We’ll shape the film together.
                                </p>
                            </motion.div>
                        ) : (
                            <motion.div
                                key="briefing-thread"
                                className={styles.briefingThread}
                                initial={enter}
                                animate={{ opacity: 1, y: 0 }}
                                transition={transition}
                            >
                                {visibleMessages.map((message, index) => (
                                    <motion.div
                                        key={message.id}
                                        className={styles.briefingMessage}
                                        data-role={message.role}
                                        initial={enter}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={transition}
                                    >
                                        <div>
                                            {message.role === "assistant" &&
                                            visibleMessages[index - 1]?.role !==
                                                "assistant" ? (
                                                <span
                                                    className={
                                                        styles.briefingMessageAuthor
                                                    }
                                                >
                                                    Director
                                                </span>
                                            ) : null}
                                            <span className={styles.srOnly}>
                                                {message.role === "assistant"
                                                    ? "Director"
                                                    : "You"}
                                                :
                                            </span>
                                            <p>{message.text}</p>
                                        </div>
                                    </motion.div>
                                ))}

                                {activity ? (
                                    <motion.div
                                        key="briefing-thinking"
                                        className={styles.briefingThinking}
                                        initial={enter}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={
                                            reduceMotion
                                                ? undefined
                                                : { opacity: 0, y: -4 }
                                        }
                                        transition={transition}
                                        role="status"
                                    >
                                        <div>
                                            <span
                                                className={
                                                    styles.briefingThinkingMark
                                                }
                                                aria-hidden="true"
                                            />
                                            <span>{activity}</span>
                                        </div>
                                    </motion.div>
                                ) : null}

                                {choices.length ? (
                                    <motion.div
                                        layout={!reduceMotion}
                                        key="briefing-set-choices"
                                        className={styles.briefingSetChoices}
                                        initial={enter}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={transition}
                                    >
                                        <div
                                            className={
                                                styles.briefingSectionLabel
                                            }
                                        >
                                            <span>Choose a direction</span>
                                            <small>
                                                Preview in 3D or keep directing
                                            </small>
                                        </div>
                                        <div>
                                            {choices.map((option) => (
                                                <SetChoiceCard
                                                    key={option.id}
                                                    option={option}
                                                    previewing={
                                                        previewSetId ===
                                                        option.id
                                                    }
                                                    selected={
                                                        selectedSetId ===
                                                        option.id
                                                    }
                                                    onPreview={() =>
                                                        onPreviewSet(option)
                                                    }
                                                    onUse={() =>
                                                        onUseSet(option)
                                                    }
                                                />
                                            ))}
                                        </div>
                                    </motion.div>
                                ) : null}

                                {showRender ? (
                                    <motion.article
                                        layout={!reduceMotion}
                                        key={
                                            renderJob?.id ||
                                            "briefing-render-preparing"
                                        }
                                        className={styles.briefingRenderCard}
                                        data-status={
                                            renderJob?.status || "preparing"
                                        }
                                        initial={enter}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={transition}
                                    >
                                        <div
                                            className={
                                                styles.briefingRenderHeader
                                            }
                                        >
                                            <span
                                                className={
                                                    styles.briefingRenderPulse
                                                }
                                            />
                                            <div>
                                                <small>Video draft</small>
                                                <strong>
                                                    {jobTitle(
                                                        renderJob,
                                                        renderPending
                                                    )}
                                                </strong>
                                            </div>
                                            {renderCredits !== null ? (
                                                <em>{renderCredits} cr</em>
                                            ) : null}
                                        </div>
                                        <div
                                            className={
                                                styles.briefingRenderProgress
                                            }
                                            data-indeterminate={
                                                !renderJob ||
                                                renderPending ||
                                                undefined
                                            }
                                            role="progressbar"
                                            aria-label="First pass generation progress"
                                            aria-valuemin={0}
                                            aria-valuemax={100}
                                            aria-valuenow={
                                                renderJob
                                                    ? Math.round(
                                                          renderJob.progress *
                                                              100
                                                      )
                                                    : undefined
                                            }
                                        >
                                            <i
                                                style={{
                                                    width: renderJob
                                                        ? `${
                                                              renderJob.progress *
                                                              100
                                                          }%`
                                                        : "32%",
                                                }}
                                            />
                                        </div>
                                        <p>{jobDescription(renderJob)}</p>
                                        {rendering ? (
                                            <button
                                                type="button"
                                                onClick={onCancelRender}
                                            >
                                                <StopIcon /> Stop generation
                                            </button>
                                        ) : renderJob &&
                                          ["failed", "cancelled"].includes(
                                              renderJob.status
                                          ) ? (
                                            <button
                                                type="button"
                                                onClick={onRetryRender}
                                            >
                                                <SparklesIcon /> Try again
                                            </button>
                                        ) : null}
                                    </motion.article>
                                ) : null}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>

            <div className={styles.briefingDock}>
                {references.length ? (
                    <div
                        className={styles.briefingReferences}
                        aria-label="Attached references"
                    >
                        {references.map((reference) => (
                            <span key={reference.id}>
                                {referenceIcon(reference.kind)}
                                <span>
                                    <strong>{reference.name}</strong>
                                    {formatSize(reference.size) ? (
                                        <small>
                                            {formatSize(reference.size)}
                                        </small>
                                    ) : null}
                                </span>
                                <button
                                    type="button"
                                    onClick={() =>
                                        onRemoveReference(reference.id)
                                    }
                                    aria-label={`Remove ${reference.name}`}
                                >
                                    <CloseIcon />
                                </button>
                            </span>
                        ))}
                    </div>
                ) : null}

                <form
                    className={styles.briefingComposer}
                    onSubmit={handleSubmit}
                >
                    <textarea
                        ref={textareaRef}
                        value={draft}
                        rows={1}
                        placeholder="Describe the film, a shot, or what should change…"
                        aria-label="Message Director"
                        onChange={(event) => onDraftChange(event.target.value)}
                        onKeyDown={(event) => {
                            if (
                                event.key === "Enter" &&
                                !event.shiftKey &&
                                !event.nativeEvent.isComposing
                            ) {
                                event.preventDefault();
                                submit();
                            }
                        }}
                    />

                    <AnimatePresence initial={false}>
                        {settingsOpen ? (
                            <motion.div
                                key="briefing-settings"
                                id="briefing-video-settings"
                                className={styles.briefingSettingsPanel}
                                initial={
                                    reduceMotion
                                        ? false
                                        : { opacity: 0, height: 0, y: 4 }
                                }
                                animate={{ opacity: 1, height: "auto", y: 0 }}
                                exit={
                                    reduceMotion
                                        ? undefined
                                        : { opacity: 0, height: 0, y: 4 }
                                }
                                transition={transition}
                            >
                                <div className={styles.briefingSettingsHeader}>
                                    <strong>Video setup</strong>
                                    <span>Seedance 2.5</span>
                                </div>
                                <div
                                    className={styles.briefingControls}
                                    aria-label="Video generation settings"
                                >
                                    <label>
                                        <span
                                            className={
                                                styles.briefingFieldLabel
                                            }
                                        >
                                            Mode
                                        </span>
                                        <select
                                            value={settings.mode}
                                            onChange={(event) =>
                                                updateSettings(
                                                    "mode",
                                                    event.target
                                                        .value as DirectorBriefingMode
                                                )
                                            }
                                            aria-label="Generation mode"
                                        >
                                            {MODE_OPTIONS.map((option) => (
                                                <option
                                                    key={option.value}
                                                    value={option.value}
                                                >
                                                    {option.label}
                                                </option>
                                            ))}
                                        </select>
                                    </label>
                                    <label>
                                        <span
                                            className={
                                                styles.briefingFieldLabel
                                            }
                                        >
                                            Duration
                                        </span>
                                        <span
                                            className={styles.briefingDuration}
                                        >
                                            <input
                                                type="number"
                                                min={4}
                                                max={30}
                                                value={settings.durationSeconds}
                                                onChange={(event) => {
                                                    const value = Number(
                                                        event.target.value
                                                    );
                                                    if (Number.isFinite(value))
                                                        updateSettings(
                                                            "durationSeconds",
                                                            value
                                                        );
                                                }}
                                                onBlur={(event) => {
                                                    const value = Math.min(
                                                        30,
                                                        Math.max(
                                                            4,
                                                            Number(
                                                                event.target
                                                                    .value
                                                            ) || 4
                                                        )
                                                    );
                                                    updateSettings(
                                                        "durationSeconds",
                                                        value
                                                    );
                                                }}
                                                aria-label="Duration in seconds"
                                            />
                                            <em>sec</em>
                                        </span>
                                    </label>
                                    <label>
                                        <span
                                            className={
                                                styles.briefingFieldLabel
                                            }
                                        >
                                            Frame
                                        </span>
                                        <select
                                            value={settings.aspectRatio}
                                            onChange={(event) =>
                                                updateSettings(
                                                    "aspectRatio",
                                                    event.target
                                                        .value as DirectorBriefingAspectRatio
                                                )
                                            }
                                            aria-label="Aspect ratio"
                                        >
                                            {ASPECT_RATIOS.map((ratio) => (
                                                <option
                                                    key={ratio}
                                                    value={ratio}
                                                >
                                                    {ratio}
                                                </option>
                                            ))}
                                        </select>
                                    </label>
                                    <label>
                                        <span
                                            className={
                                                styles.briefingFieldLabel
                                            }
                                        >
                                            Quality
                                        </span>
                                        <select
                                            value={settings.resolution}
                                            onChange={(event) =>
                                                updateSettings(
                                                    "resolution",
                                                    event.target
                                                        .value as DirectorBriefingResolution
                                                )
                                            }
                                            aria-label="Resolution"
                                        >
                                            {RESOLUTIONS.map((resolution) => (
                                                <option
                                                    key={resolution}
                                                    value={resolution}
                                                >
                                                    {resolution}
                                                </option>
                                            ))}
                                        </select>
                                    </label>
                                    <label>
                                        <span
                                            className={
                                                styles.briefingFieldLabel
                                            }
                                        >
                                            Audio
                                        </span>
                                        <button
                                            type="button"
                                            className={
                                                styles.briefingSettingButton
                                            }
                                            data-active={
                                                settings.generateAudio ||
                                                undefined
                                            }
                                            aria-pressed={
                                                settings.generateAudio
                                            }
                                            onClick={() =>
                                                updateSettings(
                                                    "generateAudio",
                                                    !settings.generateAudio
                                                )
                                            }
                                        >
                                            {settings.generateAudio
                                                ? "On"
                                                : "Off"}
                                        </button>
                                    </label>
                                    <label>
                                        <span
                                            className={
                                                styles.briefingFieldLabel
                                            }
                                        >
                                            Camera
                                        </span>
                                        <select
                                            value={settings.guideMode}
                                            onChange={(event) =>
                                                updateSettings(
                                                    "guideMode",
                                                    event.target
                                                        .value as DirectorBriefingGuideMode
                                                )
                                            }
                                            aria-label="Camera guide mode"
                                        >
                                            {GUIDE_OPTIONS.map((option) => (
                                                <option
                                                    key={option.value}
                                                    value={option.value}
                                                >
                                                    {option.label.replace(
                                                        "Guide: ",
                                                        ""
                                                    )}
                                                </option>
                                            ))}
                                        </select>
                                    </label>
                                </div>
                            </motion.div>
                        ) : null}
                    </AnimatePresence>

                    <div className={styles.briefingComposerBar}>
                        <div className={styles.briefingAttachGroup}>
                            <input
                                ref={fileInputRef}
                                className={styles.briefingFileInput}
                                type="file"
                                accept="image/*,video/*,audio/*"
                                multiple
                                tabIndex={-1}
                                aria-hidden="true"
                                onChange={(event) => {
                                    const files = Array.from(
                                        event.currentTarget.files || []
                                    );
                                    if (files.length) onAddReferences(files);
                                    event.currentTarget.value = "";
                                }}
                            />
                            <button
                                type="button"
                                className={styles.briefingAttachButton}
                                onClick={() => fileInputRef.current?.click()}
                                aria-label="Attach image, video or audio references"
                                title="Attach references"
                            >
                                <PlusIcon />
                            </button>
                        </div>

                        <button
                            type="button"
                            className={styles.briefingSetupButton}
                            aria-expanded={settingsOpen}
                            aria-controls="briefing-video-settings"
                            onClick={() => setSettingsOpen((value) => !value)}
                        >
                            <FilmIcon />
                            <span>Seedance 2.5</span>
                            <small>{settingsSummary}</small>
                            <ChevronDownIcon />
                        </button>

                        <button
                            type={busy ? "button" : "submit"}
                            className={styles.briefingSendButton}
                            onClick={busy ? onCancelReply : undefined}
                            disabled={!busy && !draft.trim()}
                            aria-label={busy ? "Stop Director" : "Send message"}
                        >
                            {busy ? <StopIcon /> : <ArrowUpIcon />}
                        </button>
                    </div>
                </form>

                {empty ? (
                    <div
                        className={styles.briefingQuickStarts}
                        aria-label="Quick starts"
                    >
                        {QUICK_STARTS.map((starter) => {
                            const Icon = starter.icon;
                            return (
                                <button
                                    key={starter.title}
                                    type="button"
                                    disabled={busy}
                                    onClick={() => {
                                        followLatestRef.current = true;
                                        onSubmit(starter.prompt);
                                    }}
                                >
                                    <Icon />
                                    <span>{starter.title}</span>
                                </button>
                            );
                        })}
                    </div>
                ) : (
                    <p className={styles.briefingHint}>
                        Enter to send · Shift + Enter for a new line
                    </p>
                )}
            </div>
        </motion.section>
    );
});
