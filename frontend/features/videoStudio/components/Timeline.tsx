import type { CSSProperties } from "react";
import type { SetOption, VideoShot } from "../model";
import {
    CloseIcon,
    DownloadIcon,
    PauseIcon,
    PlayIcon,
    PlusIcon,
    RedoIcon,
    UndoIcon,
} from "./Icons";
import styles from "./Timeline.module.css";

interface Props {
    shots: readonly VideoShot[];
    sets: readonly SetOption[];
    defaultSetId: string;
    activeShotId: string;
    currentTicks: number;
    playing: boolean;
    canUndo: boolean;
    canRedo: boolean;
    onTogglePlay: () => void;
    onSeekGlobal: (shotId: string, ticks: number) => void;
    onActivate: (shotId: string) => void;
    onUndo: () => void;
    onRedo: () => void;
    onExport: () => void;
    onAddShot: () => void;
    onClose: () => void;
}

function timecode(ticks: number) {
    const totalFrames = Math.max(0, Math.round(ticks / 1000));
    const frames = totalFrames % 30;
    const totalSeconds = Math.floor(totalFrames / 30);
    const seconds = totalSeconds % 60;
    const minutes = Math.floor(totalSeconds / 60);
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(
        2,
        "0"
    )}:${String(frames).padStart(2, "0")}`;
}

function rulerLabel(seconds: number) {
    if (seconds >= 60) {
        const roundedSeconds = Math.round(seconds);
        const minutes = Math.floor(roundedSeconds / 60);
        return `${minutes}:${String(roundedSeconds % 60).padStart(2, "0")}`;
    }
    return `${Number.isInteger(seconds) ? seconds : seconds.toFixed(1)}s`;
}

export function Timeline({
    shots,
    sets,
    defaultSetId,
    activeShotId,
    currentTicks,
    playing,
    canUndo,
    canRedo,
    onTogglePlay,
    onSeekGlobal,
    onActivate,
    onUndo,
    onRedo,
    onExport,
    onAddShot,
    onClose,
}: Props) {
    const totalTicks = shots.reduce((sum, shot) => sum + shot.durationTicks, 0);
    const activeShotIndex = Math.max(
        0,
        shots.findIndex((shot) => shot.id === activeShotId)
    );
    const elapsedBefore = shots
        .slice(0, activeShotIndex)
        .reduce((sum, shot) => sum + shot.durationTicks, 0);
    const globalTicks = elapsedBefore + currentTicks;
    const maxSeekTicks = Math.max(0, totalTicks - 1000);
    const scrubberValue = Math.min(Math.max(0, globalTicks), maxSeekTicks);
    const globalProgress = totalTicks
        ? Math.min(100, Math.max(0, (globalTicks / totalTicks) * 100))
        : 0;
    const totalSeconds = totalTicks / 30_000;
    const sequenceMinWidth = Math.max(320, Math.ceil(totalSeconds * 32));
    const setById = new Map(sets.map((set) => [set.id, set]));
    const rulerDivisions = 8;

    const seekGlobal = (ticks: number) => {
        let elapsed = 0;
        for (const [index, shot] of shots.entries()) {
            const end = elapsed + shot.durationTicks;
            if (ticks < end || index === shots.length - 1) {
                onSeekGlobal(
                    shot.id,
                    Math.min(
                        Math.max(0, ticks - elapsed),
                        shot.durationTicks - 1000
                    )
                );
                return;
            }
            elapsed = end;
        }
    };

    return (
        <section className={styles.timeline} aria-label="Video timeline">
            <header className={styles.transportHeader}>
                <div className={styles.transport}>
                    <button
                        type="button"
                        className={`${styles.iconButton} ${styles.playButton}`}
                        onClick={onTogglePlay}
                        aria-label={playing ? "Pause" : "Play selected shot"}
                        title={playing ? "Pause" : "Play selected shot"}
                    >
                        {playing ? <PauseIcon /> : <PlayIcon />}
                    </button>
                    <span className={styles.timecode}>
                        {timecode(globalTicks)}
                    </span>
                    <span className={styles.durationLabel}>
                        / {timecode(totalTicks)}
                    </span>
                    <span className={styles.transportDivider} />
                    <button
                        type="button"
                        className={styles.iconButton}
                        onClick={onExport}
                        aria-label="Export camera guide"
                        title="Export camera guide"
                    >
                        <DownloadIcon />
                    </button>
                </div>

                <div className={styles.timelineTitle}>
                    <span>Sequence 01</span>
                    <small>
                        {shots.length} {shots.length === 1 ? "shot" : "shots"}
                        <i />
                        {totalSeconds.toFixed(0)}s
                    </small>
                </div>

                <div className={styles.historyControls}>
                    <button
                        type="button"
                        className={styles.iconButton}
                        onClick={onUndo}
                        disabled={!canUndo}
                        aria-label="Undo"
                        title="Undo"
                    >
                        <UndoIcon />
                    </button>
                    <button
                        type="button"
                        className={styles.iconButton}
                        onClick={onRedo}
                        disabled={!canRedo}
                        aria-label="Redo"
                        title="Redo"
                    >
                        <RedoIcon />
                    </button>
                    <span className={styles.historyDivider} />
                    <button
                        type="button"
                        className={styles.iconButton}
                        onClick={onClose}
                        aria-label="Close timeline"
                        title="Close timeline"
                    >
                        <CloseIcon />
                    </button>
                </div>
            </header>

            <div className={styles.timelineBody}>
                <div className={styles.rulerCorner} aria-hidden="true">
                    Time
                </div>
                <div className={styles.trackLabel}>
                    <span aria-hidden="true" />
                    <strong>Camera</strong>
                    <small>V1</small>
                </div>

                <div className={styles.scrollViewport}>
                    <div
                        className={styles.timelineContent}
                        style={
                            {
                                "--sequence-min-width": `${sequenceMinWidth}px`,
                            } as CSSProperties
                        }
                    >
                        <div
                            className={styles.sequenceInstrument}
                            data-playing={playing || undefined}
                        >
                            <div className={styles.ruler} aria-hidden="true">
                                {Array.from(
                                    { length: rulerDivisions + 1 },
                                    (_, index) => (
                                        <span
                                            key={index}
                                            data-edge={
                                                index === 0
                                                    ? "start"
                                                    : index === rulerDivisions
                                                    ? "end"
                                                    : undefined
                                            }
                                            style={{
                                                left: `${
                                                    (index / rulerDivisions) *
                                                    100
                                                }%`,
                                            }}
                                        >
                                            {rulerLabel(
                                                (totalSeconds /
                                                    rulerDivisions) *
                                                    index
                                            )}
                                        </span>
                                    )
                                )}
                            </div>

                            <div className={styles.shotTrack}>
                                {shots.map((shot, index) => {
                                    const set = setById.get(
                                        shot.setId ?? defaultSetId
                                    );
                                    const durationSeconds =
                                        shot.durationTicks / 30_000;
                                    return (
                                        <button
                                            type="button"
                                            key={shot.id}
                                            className={styles.shotClip}
                                            data-active={
                                                shot.id === activeShotId ||
                                                undefined
                                            }
                                            aria-current={
                                                shot.id === activeShotId
                                                    ? "true"
                                                    : undefined
                                            }
                                            aria-label={`${
                                                shot.name
                                            }, ${durationSeconds.toFixed(
                                                1
                                            )} seconds, ${set?.title ?? "Set"}`}
                                            title={`${shot.name} · ${
                                                set?.title ?? "Set"
                                            } · ${durationSeconds.toFixed(1)}s`}
                                            style={
                                                {
                                                    flexGrow:
                                                        shot.durationTicks,
                                                    "--clip-color":
                                                        set?.palette[0] ??
                                                        "var(--studio-line-strong)",
                                                } as CSSProperties
                                            }
                                            onClick={() => onActivate(shot.id)}
                                        >
                                            <span className={styles.clipIndex}>
                                                {String(index + 1).padStart(
                                                    2,
                                                    "0"
                                                )}
                                            </span>
                                            <span className={styles.clipCopy}>
                                                <strong>{shot.name}</strong>
                                                <small>
                                                    {set?.title ?? "Set"}
                                                </small>
                                            </span>
                                            <span
                                                className={styles.clipDuration}
                                            >
                                                {durationSeconds.toFixed(1)}s
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>

                            <input
                                aria-label="Scrub sequence"
                                aria-valuetext={`${timecode(
                                    globalTicks
                                )} of ${timecode(totalTicks)}`}
                                className={styles.scrubber}
                                type="range"
                                min={0}
                                max={maxSeekTicks}
                                step={1000}
                                value={scrubberValue}
                                onChange={(event) =>
                                    seekGlobal(Number(event.target.value))
                                }
                            />
                            <div
                                className={styles.playhead}
                                style={{ left: `${globalProgress}%` }}
                                aria-hidden="true"
                            >
                                <span />
                            </div>
                        </div>

                        <button
                            type="button"
                            className={styles.addShotButton}
                            onClick={onAddShot}
                            aria-label="Add shot"
                            title="Add shot"
                        >
                            <PlusIcon />
                        </button>
                    </div>
                </div>
            </div>
        </section>
    );
}
