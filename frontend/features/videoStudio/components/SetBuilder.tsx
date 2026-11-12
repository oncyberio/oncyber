import {
    useEffect,
    useRef,
    useState,
    type CSSProperties,
    type FormEvent,
} from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { SetConstructionTemplate } from "../model";
import styles from "./SetBuilder.module.css";
import {
    CheckIcon,
    CloseIcon,
    ImageIcon,
    LayersIcon,
    SparklesIcon,
} from "./Icons";
import { TuneColor, TuneSection, TuneText } from "./controls/TuneControls";

export interface SetBuilderValue {
    readonly title: string;
    readonly direction: string;
    readonly template: SetConstructionTemplate;
    readonly palette: readonly [string, string, string];
}

interface Props {
    open: boolean;
    nextShotNumber: number;
    onCreate: (value: SetBuilderValue) => void;
    onClose: () => void;
}

const TEMPLATES: readonly {
    id: SetConstructionTemplate;
    title: string;
    detail: string;
    palette: readonly [string, string, string];
}[] = [
    {
        id: "gallery",
        title: "Gallery",
        detail: "Walls, plinths and clean camera lanes",
        palette: ["#e9e5da", "#bbb4a7", "#252522"],
    },
    {
        id: "pavilion",
        title: "Pavilion",
        detail: "Columns, portals and a graphic runway",
        palette: ["#315dde", "#94b2ff", "#eee3c9"],
    },
    {
        id: "landscape",
        title: "Landscape",
        detail: "Open ground, monoliths and an orbit path",
        palette: ["#e9785c", "#60487b", "#f0ce93"],
    },
] as const;

const PALETTE_LABELS = ["Structure", "Accent", "Ground"] as const;

function SetPreview({
    template,
    palette,
    title,
}: {
    template: SetConstructionTemplate;
    palette: readonly [string, string, string];
    title: string;
}) {
    return (
        <svg
            className={styles.scene}
            viewBox="0 0 800 560"
            preserveAspectRatio="xMidYMid slice"
            role="img"
            aria-label={`${title || "Untitled set"} ${template} preview`}
        >
            <defs>
                <linearGradient
                    id="set-preview-vignette"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                >
                    <stop offset="0" stopColor="#ffffff" stopOpacity="0.05" />
                    <stop offset="0.72" stopColor="#000000" stopOpacity="0" />
                    <stop offset="1" stopColor="#000000" stopOpacity="0.28" />
                </linearGradient>
                <pattern
                    id="set-preview-grid"
                    width="28"
                    height="28"
                    patternUnits="userSpaceOnUse"
                >
                    <path
                        d="M 28 0 L 0 0 0 28"
                        fill="none"
                        stroke="#ffffff"
                        strokeOpacity="0.055"
                        strokeWidth="1"
                    />
                </pattern>
            </defs>

            <rect width="800" height="560" fill="#0d0d0d" />

            {template === "gallery" ? (
                <g>
                    <polygon
                        points="78,64 722,64 650,374 150,374"
                        fill={palette[0]}
                    />
                    <polygon
                        points="78,64 150,374 150,520 38,438"
                        fill={palette[1]}
                    />
                    <polygon
                        points="722,64 650,374 650,520 762,438"
                        fill={palette[1]}
                        opacity="0.72"
                    />
                    <polygon
                        points="150,374 650,374 762,520 38,520"
                        fill={palette[2]}
                    />
                    <g className={styles.artworks}>
                        <rect x="208" y="132" width="112" height="146" rx="2" />
                        <rect x="344" y="105" width="112" height="173" rx="2" />
                        <rect x="480" y="132" width="112" height="146" rx="2" />
                        <rect x="216" y="140" width="96" height="130" rx="1" />
                        <rect x="352" y="113" width="96" height="157" rx="1" />
                        <rect x="488" y="140" width="96" height="130" rx="1" />
                    </g>
                    <g fill={palette[0]}>
                        <path d="M244 356h54l11 88h-76l11-88Z" />
                        <path d="M373 342h54l15 102h-84l15-102Z" />
                        <path d="M502 356h54l11 88h-76l11-88Z" />
                    </g>
                    <g fill="#ffffff" opacity="0.12">
                        <path d="M244 356h54l-5 8h-47l-2-8Z" />
                        <path d="M373 342h54l-5 8h-47l-2-8Z" />
                        <path d="M502 356h54l-5 8h-47l-2-8Z" />
                    </g>
                </g>
            ) : null}

            {template === "pavilion" ? (
                <g>
                    <rect width="800" height="560" fill={palette[2]} />
                    <rect
                        width="800"
                        height="350"
                        fill={palette[1]}
                        opacity="0.72"
                    />
                    <polygon
                        points="0,350 800,350 800,560 0,560"
                        fill={palette[2]}
                    />
                    <path
                        d="M270 350V112h260v238h-62V184c-17-40-47-60-68-60s-51 20-68 60v166h-62Z"
                        fill={palette[0]}
                    />
                    <path
                        d="M332 350V186c14-37 43-56 68-56s54 19 68 56v164H332Z"
                        fill="#101010"
                        opacity="0.82"
                    />
                    <g fill={palette[0]}>
                        <path d="M82 112h58l12 238H70l12-238Z" />
                        <path d="M660 112h58l12 238h-82l12-238Z" />
                        <path d="M180 160h42l9 190h-60l9-190Z" />
                        <path d="M578 160h42l9 190h-60l9-190Z" />
                    </g>
                    <g fill="#ffffff" opacity="0.14">
                        <rect x="74" y="100" width="74" height="18" rx="2" />
                        <rect x="652" y="100" width="74" height="18" rx="2" />
                        <rect x="174" y="150" width="54" height="14" rx="2" />
                        <rect x="572" y="150" width="54" height="14" rx="2" />
                    </g>
                    <polygon
                        points="350,350 450,350 536,560 264,560"
                        fill={palette[0]}
                        opacity="0.88"
                    />
                    <path
                        d="M400 350v210"
                        stroke="#ffffff"
                        strokeOpacity="0.18"
                    />
                </g>
            ) : null}

            {template === "landscape" ? (
                <g>
                    <rect width="800" height="560" fill={palette[1]} />
                    <circle
                        cx="625"
                        cy="128"
                        r="62"
                        fill={palette[2]}
                        opacity="0.84"
                    />
                    <path
                        d="M0 298 116 224l104 61 118-116 117 102 116-67 149 86 80-49v319H0V298Z"
                        fill={palette[0]}
                        opacity="0.72"
                    />
                    <path
                        d="M0 353c115-52 190-18 282-40 105-25 161-74 250-42 91 32 166 25 268-12v301H0V353Z"
                        fill={palette[2]}
                    />
                    <path
                        d="m158 392 34-173 65-31 22 204-36 88-75-5-10-83Z"
                        fill={palette[0]}
                    />
                    <path
                        d="m535 375 28-143 54-26 18 169-30 73-62-4-8-69Z"
                        fill={palette[0]}
                        opacity="0.88"
                    />
                    <path
                        d="m331 344 19-98 38-18 13 116-21 50-43-3-6-47Z"
                        fill={palette[1]}
                    />
                    <path
                        d="M140 499c98-108 346-138 526-16"
                        fill="none"
                        stroke={palette[0]}
                        strokeOpacity="0.56"
                        strokeWidth="52"
                    />
                </g>
            ) : null}

            <rect width="800" height="560" fill="url(#set-preview-vignette)" />
            <rect width="800" height="560" fill="url(#set-preview-grid)" />

            <g className={styles.cameraPath}>
                <path d="M128 482C271 429 473 432 671 484" />
                <circle cx="128" cy="482" r="6" />
                <circle cx="671" cy="484" r="6" />
            </g>
        </svg>
    );
}

export function SetBuilder({ open, nextShotNumber, onCreate, onClose }: Props) {
    const reduceMotion = useReducedMotion();
    const titleRef = useRef<HTMLInputElement>(null);
    const timerRef = useRef<number | null>(null);
    const [title, setTitle] = useState("New set");
    const [direction, setDirection] = useState(
        "A cinematic architectural environment with a clear hero camera lane"
    );
    const [template, setTemplate] =
        useState<SetConstructionTemplate>("gallery");
    const [palette, setPalette] = useState<readonly [string, string, string]>(
        TEMPLATES[0].palette
    );
    const [building, setBuilding] = useState(false);
    const selectedTemplate =
        TEMPLATES.find((option) => option.id === template) ?? TEMPLATES[0];

    useEffect(() => {
        if (!open) return;
        setTitle(`Set ${String(nextShotNumber).padStart(2, "0")}`);
        setBuilding(false);
        const frame = window.requestAnimationFrame(() =>
            titleRef.current?.select()
        );
        return () => window.cancelAnimationFrame(frame);
    }, [nextShotNumber, open]);

    useEffect(
        () => () => {
            if (timerRef.current !== null)
                window.clearTimeout(timerRef.current);
        },
        []
    );

    const submit = (event: FormEvent) => {
        event.preventDefault();
        if (!title.trim() || !direction.trim() || building) return;
        setBuilding(true);
        timerRef.current = window.setTimeout(() => {
            onCreate({
                title: title.trim(),
                direction: direction.trim(),
                template,
                palette,
            });
            setBuilding(false);
        }, 680);
    };

    return (
        <AnimatePresence>
            {open ? (
                <motion.div
                    className={styles.backdrop}
                    initial={reduceMotion ? false : { opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={reduceMotion ? undefined : { opacity: 0 }}
                    transition={{ duration: reduceMotion ? 0 : 0.16 }}
                    onPointerDown={(event) => {
                        if (event.target === event.currentTarget && !building)
                            onClose();
                    }}
                >
                    <motion.form
                        className={styles.dialog}
                        role="dialog"
                        aria-modal="true"
                        aria-label="Construct new set"
                        aria-busy={building}
                        onSubmit={submit}
                        onKeyDown={(event) => {
                            if (event.key === "Escape" && !building) onClose();
                        }}
                        initial={
                            reduceMotion
                                ? false
                                : { opacity: 0, y: 8, scale: 0.99 }
                        }
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={
                            reduceMotion
                                ? undefined
                                : { opacity: 0, y: 4, scale: 0.995 }
                        }
                        transition={{
                            duration: reduceMotion ? 0 : 0.2,
                            ease: [0.2, 0.8, 0.2, 1],
                        }}
                    >
                        <header className={styles.header}>
                            <div className={styles.heading}>
                                <span className={styles.headingIcon}>
                                    <LayersIcon />
                                </span>
                                <div>
                                    <strong>Construct set</strong>
                                    <small>
                                        Shot {nextShotNumber} · Editable 3D
                                        starting point
                                    </small>
                                </div>
                            </div>
                            <button
                                className={styles.closeButton}
                                type="button"
                                onClick={onClose}
                                disabled={building}
                                aria-label="Close set builder"
                            >
                                <CloseIcon />
                            </button>
                        </header>

                        <div className={styles.workspace}>
                            <section
                                className={styles.previewPane}
                                aria-label="Live set preview"
                            >
                                <div className={styles.previewToolbar}>
                                    <span>Live set preview</span>
                                    <small>Camera lane included</small>
                                </div>
                                <div className={styles.previewFrame}>
                                    <AnimatePresence
                                        mode="wait"
                                        initial={false}
                                    >
                                        <motion.div
                                            key={template}
                                            className={styles.previewScene}
                                            initial={
                                                reduceMotion
                                                    ? false
                                                    : { opacity: 0 }
                                            }
                                            animate={{ opacity: 1 }}
                                            exit={
                                                reduceMotion
                                                    ? undefined
                                                    : { opacity: 0 }
                                            }
                                            transition={{
                                                duration: reduceMotion
                                                    ? 0
                                                    : 0.18,
                                            }}
                                        >
                                            <SetPreview
                                                template={template}
                                                palette={palette}
                                                title={title}
                                            />
                                        </motion.div>
                                    </AnimatePresence>
                                    <div className={styles.previewCaption}>
                                        <div>
                                            <strong>
                                                {title || "Untitled set"}
                                            </strong>
                                            <small>
                                                {selectedTemplate.title}
                                            </small>
                                        </div>
                                        <span>
                                            <i /> spline-ready
                                        </span>
                                    </div>
                                </div>
                            </section>

                            <aside
                                className={styles.tuner}
                                aria-label="Set controls"
                            >
                                <div className={styles.tunerHeader}>
                                    <span>Set controls</span>
                                    <small>Updates live</small>
                                </div>
                                <div className={styles.tunerSections}>
                                    <TuneSection
                                        title="Identity"
                                        icon={<SparklesIcon />}
                                        summary={title || "Untitled"}
                                    >
                                        <TuneText
                                            label="Name"
                                            value={title}
                                            maxLength={120}
                                            inputRef={titleRef}
                                            onChange={setTitle}
                                        />
                                        <TuneText
                                            label="Direction"
                                            value={direction}
                                            multiline
                                            maxLength={220}
                                            onChange={setDirection}
                                        />
                                    </TuneSection>

                                    <TuneSection
                                        title="Structure"
                                        icon={<LayersIcon />}
                                        summary={selectedTemplate.title}
                                    >
                                        <fieldset
                                            className={styles.templatePicker}
                                        >
                                            <legend className={styles.srOnly}>
                                                Starting structure
                                            </legend>
                                            <div>
                                                {TEMPLATES.map((option) => {
                                                    const selected =
                                                        option.id === template;
                                                    return (
                                                        <button
                                                            key={option.id}
                                                            type="button"
                                                            aria-label={`${option.title}: ${option.detail}`}
                                                            aria-pressed={
                                                                selected
                                                            }
                                                            data-active={
                                                                selected ||
                                                                undefined
                                                            }
                                                            onClick={() => {
                                                                setTemplate(
                                                                    option.id
                                                                );
                                                                setPalette(
                                                                    option.palette
                                                                );
                                                            }}
                                                        >
                                                            <span
                                                                className={
                                                                    styles.templateVisual
                                                                }
                                                                data-template={
                                                                    option.id
                                                                }
                                                                style={
                                                                    {
                                                                        "--template-primary":
                                                                            option
                                                                                .palette[0],
                                                                        "--template-secondary":
                                                                            option
                                                                                .palette[1],
                                                                        "--template-ground":
                                                                            option
                                                                                .palette[2],
                                                                    } as CSSProperties
                                                                }
                                                            >
                                                                <i />
                                                                <i />
                                                                <i />
                                                            </span>
                                                            <span
                                                                className={
                                                                    styles.templateName
                                                                }
                                                            >
                                                                {option.title}
                                                            </span>
                                                            {selected ? (
                                                                <span
                                                                    className={
                                                                        styles.templateCheck
                                                                    }
                                                                >
                                                                    <CheckIcon />
                                                                </span>
                                                            ) : null}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </fieldset>
                                        <p className={styles.templateDetail}>
                                            {selectedTemplate.detail}
                                        </p>
                                    </TuneSection>

                                    <TuneSection
                                        title="Materials"
                                        icon={<ImageIcon />}
                                        summary={`${palette.length} colors`}
                                    >
                                        {palette.map((color, index) => (
                                            <TuneColor
                                                key={index}
                                                label={PALETTE_LABELS[index]}
                                                value={color}
                                                onChange={(value) => {
                                                    const next = [
                                                        ...palette,
                                                    ] as [
                                                        string,
                                                        string,
                                                        string
                                                    ];
                                                    next[index] = value;
                                                    setPalette(next);
                                                }}
                                            />
                                        ))}
                                    </TuneSection>
                                </div>
                            </aside>
                        </div>

                        <footer className={styles.footer}>
                            <p aria-live="polite">
                                {building
                                    ? "Building editable geometry and the first shot…"
                                    : "Geometry and materials stay editable in Studio."}
                            </p>
                            <button
                                type="submit"
                                disabled={
                                    building ||
                                    !title.trim() ||
                                    !direction.trim()
                                }
                            >
                                {building ? (
                                    <span className={styles.spinner} />
                                ) : (
                                    <SparklesIcon />
                                )}
                                {building
                                    ? "Constructing set…"
                                    : "Create set + shot"}
                            </button>
                        </footer>
                    </motion.form>
                </motion.div>
            ) : null}
        </AnimatePresence>
    );
}
