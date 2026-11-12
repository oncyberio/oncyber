import {
    type CSSProperties,
    type RefObject,
    type ReactNode,
    useEffect,
    useId,
    useRef,
    useState,
} from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronDownIcon } from "../Icons";
import styles from "./TuneControls.module.css";

type Option<T extends string> = {
    readonly value: T;
    readonly label: string;
    readonly icon?: ReactNode;
};

const clamp = (value: number, min: number, max: number) =>
    Math.min(max, Math.max(min, value));

const stepPrecision = (step: number) => {
    if (!Number.isFinite(step)) return 0;
    const value = String(step);
    if (value.includes("e-")) return Number(value.split("e-")[1]);
    return value.split(".")[1]?.length ?? 0;
};

const snap = (value: number, min: number, max: number, step: number) => {
    const precision = stepPrecision(step);
    const origin = Number.isFinite(min) ? min : 0;
    const stepped = origin + Math.round((value - origin) / step) * step;
    return Number(clamp(stepped, min, max).toFixed(precision));
};

const formatNumber = (value: number, precision: number) =>
    precision > 0
        ? value.toFixed(precision).replace(/\.?0+$/, "")
        : String(Math.round(value));

export function TuneSection({
    title,
    icon,
    summary,
    defaultOpen = true,
    children,
}: {
    title: string;
    icon?: ReactNode;
    summary?: string;
    defaultOpen?: boolean;
    children: ReactNode;
}) {
    const [open, setOpen] = useState(defaultOpen);
    const reduceMotion = useReducedMotion();
    const contentId = useId();

    return (
        <section className={styles.section} data-open={open || undefined}>
            <button
                type="button"
                className={styles.sectionHeader}
                aria-expanded={open}
                aria-controls={contentId}
                onClick={() => setOpen((value) => !value)}
            >
                <span className={styles.sectionTitle}>
                    {icon ? <i>{icon}</i> : null}
                    {title}
                </span>
                {summary ? (
                    <span className={styles.sectionSummary}>{summary}</span>
                ) : null}
                <ChevronDownIcon className={styles.sectionChevron} />
            </button>
            <AnimatePresence initial={false}>
                {open ? (
                    <motion.div
                        id={contentId}
                        className={styles.sectionBody}
                        initial={
                            reduceMotion
                                ? false
                                : { height: 0, opacity: 0, y: -2 }
                        }
                        animate={{ height: "auto", opacity: 1, y: 0 }}
                        exit={
                            reduceMotion
                                ? undefined
                                : { height: 0, opacity: 0, y: -2 }
                        }
                        transition={{
                            duration: reduceMotion ? 0 : 0.18,
                            ease: [0.25, 1, 0.5, 1],
                        }}
                    >
                        <div className={styles.sectionBodyInner}>
                            {children}
                        </div>
                    </motion.div>
                ) : null}
            </AnimatePresence>
        </section>
    );
}

export function TuneSegmented<T extends string>({
    label,
    value,
    options,
    onChange,
}: {
    label: string;
    value: T;
    options: readonly Option<T>[];
    onChange: (value: T) => void;
}) {
    const groupId = useId();
    const reduceMotion = useReducedMotion();

    return (
        <div className={styles.segmentedField}>
            <span className={styles.fieldLabel}>{label}</span>
            <div className={styles.segmented} role="group" aria-label={label}>
                {options.map((option) => {
                    const selected = option.value === value;
                    return (
                        <button
                            type="button"
                            key={option.value}
                            aria-pressed={selected}
                            data-active={selected || undefined}
                            onClick={() => {
                                if (!selected) onChange(option.value);
                            }}
                        >
                            {selected ? (
                                <motion.span
                                    className={styles.segmentedSelection}
                                    layoutId={`tune-selection-${groupId}`}
                                    transition={{
                                        duration: reduceMotion ? 0 : 0.18,
                                        ease: [0.25, 1, 0.5, 1],
                                    }}
                                />
                            ) : null}
                            <span className={styles.segmentedLabel}>
                                {option.icon}
                                {option.label}
                            </span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

export function TuneSelect<T extends string>({
    label,
    value,
    options,
    onChange,
}: {
    label: string;
    value: T;
    options: readonly Omit<Option<T>, "icon">[];
    onChange: (value: T) => void;
}) {
    return (
        <label className={styles.selectRow}>
            <span>{label}</span>
            <span className={styles.selectValue}>
                <select
                    value={value}
                    aria-label={label}
                    onChange={(event) => onChange(event.target.value as T)}
                >
                    {options.map((option) => (
                        <option key={option.value} value={option.value}>
                            {option.label}
                        </option>
                    ))}
                </select>
                <ChevronDownIcon />
            </span>
        </label>
    );
}

export function TuneSlider({
    label,
    value,
    min,
    max,
    step = 1,
    unit,
    defaultValue,
    precision = Math.min(stepPrecision(step), 2),
    onCommit,
}: {
    label: string;
    value: number;
    min: number;
    max: number;
    step?: number;
    unit?: string;
    defaultValue?: number;
    precision?: number;
    onCommit: (value: number) => void;
}) {
    const id = useId();
    const pointerActive = useRef(false);
    const exactInputActive = useRef(false);
    const cancelExact = useRef(false);
    const commitTimer = useRef<number | null>(null);
    const pendingCommit = useRef<number | null>(null);
    const [dragging, setDragging] = useState(false);
    const [draft, setDraft] = useState(value);
    const [exactDraft, setExactDraft] = useState(
        formatNumber(value, precision)
    );

    useEffect(() => {
        if (pointerActive.current || exactInputActive.current) return;
        setDraft(value);
        setExactDraft(formatNumber(value, precision));
    }, [precision, value]);

    useEffect(
        () => () => {
            if (commitTimer.current !== null)
                window.clearTimeout(commitTimer.current);
        },
        []
    );

    const commit = (next = draft) => {
        const normalized = snap(next, min, max, step);
        setDraft(normalized);
        setExactDraft(formatNumber(normalized, precision));
        if (normalized !== value) onCommit(normalized);
    };

    const scheduleCommit = (next: number) => {
        if (commitTimer.current !== null)
            window.clearTimeout(commitTimer.current);
        pendingCommit.current = next;
        commitTimer.current = window.setTimeout(() => {
            commitTimer.current = null;
            pendingCommit.current = null;
            commit(next);
        }, 180);
    };

    const flushScheduledCommit = () => {
        if (commitTimer.current === null || pendingCommit.current === null)
            return;
        window.clearTimeout(commitTimer.current);
        commitTimer.current = null;
        const next = pendingCommit.current;
        pendingCommit.current = null;
        commit(next);
    };

    const fill = ((clamp(draft, min, max) - min) / (max - min)) * 100;

    return (
        <div
            className={styles.sliderRow}
            style={{ "--tune-fill": `${fill}%` } as CSSProperties}
            data-dragging={dragging || undefined}
        >
            <label htmlFor={id} className={styles.sliderLabel}>
                {label}
            </label>
            <span className={styles.sliderValue}>
                <input
                    aria-label={`${label} exact value`}
                    inputMode="decimal"
                    value={exactDraft}
                    onFocus={(event) => {
                        exactInputActive.current = true;
                        cancelExact.current = false;
                        event.currentTarget.select();
                    }}
                    onChange={(event) => setExactDraft(event.target.value)}
                    onBlur={() => {
                        exactInputActive.current = false;
                        if (cancelExact.current) {
                            cancelExact.current = false;
                            setDraft(value);
                            setExactDraft(formatNumber(value, precision));
                            return;
                        }
                        const parsed = Number(exactDraft);
                        if (Number.isFinite(parsed)) commit(parsed);
                        else setExactDraft(formatNumber(value, precision));
                    }}
                    onKeyDown={(event) => {
                        if (event.key === "Enter") event.currentTarget.blur();
                        if (event.key === "Escape") {
                            cancelExact.current = true;
                            event.currentTarget.blur();
                        }
                    }}
                    onDoubleClick={(event) => {
                        if (defaultValue === undefined) return;
                        event.preventDefault();
                        if (commitTimer.current !== null)
                            window.clearTimeout(commitTimer.current);
                        commitTimer.current = null;
                        pendingCommit.current = null;
                        commit(defaultValue);
                    }}
                    title={
                        defaultValue === undefined
                            ? undefined
                            : "Double-click to reset"
                    }
                />
                {unit ? <small>{unit}</small> : null}
            </span>
            <input
                id={id}
                className={styles.sliderInput}
                aria-label={label}
                type="range"
                min={min}
                max={max}
                step={step}
                value={draft}
                onPointerDown={() => {
                    if (commitTimer.current !== null)
                        window.clearTimeout(commitTimer.current);
                    commitTimer.current = null;
                    pendingCommit.current = null;
                    pointerActive.current = true;
                    setDragging(true);
                }}
                onPointerUp={(event) => {
                    pointerActive.current = false;
                    setDragging(false);
                    commit(Number(event.currentTarget.value));
                }}
                onPointerCancel={() => {
                    pointerActive.current = false;
                    setDragging(false);
                    if (commitTimer.current !== null) {
                        window.clearTimeout(commitTimer.current);
                        commitTimer.current = null;
                    }
                    pendingCommit.current = null;
                    setDraft(value);
                    setExactDraft(formatNumber(value, precision));
                }}
                onBlur={flushScheduledCommit}
                onChange={(event) => {
                    const next = Number(event.currentTarget.value);
                    setDraft(next);
                    setExactDraft(formatNumber(next, precision));
                    if (!pointerActive.current) scheduleCommit(next);
                }}
            />
        </div>
    );
}

export function TuneNumber({
    label,
    value,
    unit,
    min = -Infinity,
    max = Infinity,
    step = 0.1,
    precision = Math.min(stepPrecision(step), 2),
    onCommit,
}: {
    label: string;
    value: number;
    unit?: string;
    min?: number;
    max?: number;
    step?: number;
    precision?: number;
    onCommit: (value: number) => void;
}) {
    const [draft, setDraft] = useState(formatNumber(value, precision));
    const [scrubbing, setScrubbing] = useState(false);
    const cancelExact = useRef(false);
    const scrub = useRef<{
        pointerId: number;
        startX: number;
        startValue: number;
        nextValue: number;
    } | null>(null);

    useEffect(
        () => setDraft(formatNumber(value, precision)),
        [precision, value]
    );

    const commit = (nextDraft = draft) => {
        const parsed = Number(nextDraft);
        if (!Number.isFinite(parsed)) {
            setDraft(formatNumber(value, precision));
            return;
        }
        const bounded = clamp(parsed, min, max);
        setDraft(formatNumber(bounded, precision));
        if (bounded !== value) onCommit(bounded);
    };

    return (
        <label
            className={styles.numberRow}
            data-scrubbing={scrubbing || undefined}
            onPointerDown={(event) => {
                if (
                    event.button !== 0 ||
                    event.target instanceof HTMLInputElement
                )
                    return;
                event.preventDefault();
                event.currentTarget.setPointerCapture(event.pointerId);
                scrub.current = {
                    pointerId: event.pointerId,
                    startX: event.clientX,
                    startValue: value,
                    nextValue: value,
                };
                setScrubbing(true);
            }}
            onPointerMove={(event) => {
                if (
                    !scrub.current ||
                    scrub.current.pointerId !== event.pointerId
                )
                    return;
                const activeStep = event.shiftKey ? step / 10 : step;
                const next = snap(
                    scrub.current.startValue +
                        (event.clientX - scrub.current.startX) * activeStep,
                    min,
                    max,
                    activeStep
                );
                scrub.current.nextValue = next;
                setDraft(
                    formatNumber(
                        next,
                        event.shiftKey ? precision + 1 : precision
                    )
                );
            }}
            onPointerUp={(event) => {
                if (
                    !scrub.current ||
                    scrub.current.pointerId !== event.pointerId
                )
                    return;
                const next = scrub.current.nextValue;
                scrub.current = null;
                setScrubbing(false);
                event.currentTarget.releasePointerCapture(event.pointerId);
                commit(String(next));
            }}
            onPointerCancel={() => {
                scrub.current = null;
                setScrubbing(false);
                setDraft(formatNumber(value, precision));
            }}
        >
            <span>{label}</span>
            <span className={styles.numberValue}>
                <input
                    type="number"
                    inputMode="decimal"
                    value={draft}
                    min={Number.isFinite(min) ? min : undefined}
                    max={Number.isFinite(max) ? max : undefined}
                    step={step}
                    onFocus={(event) => {
                        cancelExact.current = false;
                        event.currentTarget.select();
                    }}
                    onChange={(event) => setDraft(event.target.value)}
                    onBlur={() => {
                        if (cancelExact.current) {
                            cancelExact.current = false;
                            setDraft(formatNumber(value, precision));
                            return;
                        }
                        commit();
                    }}
                    onKeyDown={(event) => {
                        if (event.key === "Enter") event.currentTarget.blur();
                        if (event.key === "Escape") {
                            cancelExact.current = true;
                            event.currentTarget.blur();
                        }
                    }}
                />
                {unit ? <small>{unit}</small> : null}
            </span>
        </label>
    );
}

export function TuneText({
    label,
    value,
    multiline = false,
    maxLength,
    inputRef,
    onChange,
    onCommit,
}: {
    label: string;
    value: string;
    multiline?: boolean;
    maxLength?: number;
    inputRef?: RefObject<HTMLInputElement>;
    onChange: (value: string) => void;
    onCommit?: (value: string) => void;
}) {
    if (multiline) {
        return (
            <label className={styles.textAreaField}>
                <span>{label}</span>
                <textarea
                    value={value}
                    rows={3}
                    maxLength={maxLength}
                    onChange={(event) => onChange(event.target.value)}
                    onBlur={() => onCommit?.(value)}
                    onKeyDown={(event) => {
                        if (
                            (event.metaKey || event.ctrlKey) &&
                            event.key === "Enter"
                        )
                            event.currentTarget.blur();
                    }}
                />
            </label>
        );
    }

    return (
        <label className={styles.textRow}>
            <span>{label}</span>
            <input
                ref={inputRef}
                value={value}
                maxLength={maxLength}
                onChange={(event) => onChange(event.target.value)}
                onBlur={() => onCommit?.(value)}
                onKeyDown={(event) => {
                    if (event.key === "Enter") event.currentTarget.blur();
                }}
            />
        </label>
    );
}

export function TuneColor({
    label,
    value,
    onChange,
}: {
    label: string;
    value: string;
    onChange: (value: string) => void;
}) {
    return (
        <label className={styles.colorRow}>
            <span>{label}</span>
            <span className={styles.colorValue}>
                <input
                    type="color"
                    value={value}
                    aria-label={label}
                    onChange={(event) => onChange(event.target.value)}
                />
                <small>{value.toUpperCase()}</small>
            </span>
        </label>
    );
}
