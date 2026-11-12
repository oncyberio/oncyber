import { useEffect, useState } from "react";
import { InspectorFrame } from "@features/studio/EditWorldMenu/AddAsset/EditAsset/EditAssetLayout/InspectorFrame";
import type {
    VideoArtwork,
    VideoOperation,
    VideoProjectV1,
    VideoShot,
} from "../model";
import type { PathKind } from "../engine/createVideoEngine";
import shellStyles from "../VideoStudioShell.module.css";
import { ImageIcon, PathIcon, TargetIcon } from "./Icons";
import {
    TuneNumber,
    TuneSelect,
    TuneSection,
    TuneSegmented,
    TuneSlider,
    TuneText,
} from "./controls/TuneControls";
import styles from "./TunedInspector.module.css";

const operationId = (prefix: string) =>
    `${prefix}-${Date.now().toString(36)}-${Math.random()
        .toString(36)
        .slice(2, 6)}`;

function DeferredText({
    value,
    onCommit,
    multiline = false,
    label,
    maxLength,
}: {
    value: string;
    onCommit: (value: string) => void;
    multiline?: boolean;
    label: string;
    maxLength: number;
}) {
    const [draft, setDraft] = useState(value);
    useEffect(() => setDraft(value), [value]);

    return (
        <TuneText
            label={label}
            value={draft}
            multiline={multiline}
            maxLength={maxLength}
            onChange={setDraft}
            onCommit={(next) => next !== value && onCommit(next)}
        />
    );
}

interface Props {
    project: VideoProjectV1;
    shot: VideoShot;
    artwork: VideoArtwork | null;
    pathKind: PathKind;
    activePointIndex: number;
    onPathKind: (kind: PathKind) => void;
    onActivePointIndex: (index: number) => void;
    onClose: () => void;
    dispatch: (operation: VideoOperation, label?: string) => void;
}

export function TunedInspector({
    project,
    shot,
    artwork,
    pathKind,
    activePointIndex,
    onPathKind,
    onActivePointIndex,
    onClose,
    dispatch,
}: Props) {
    const points = shot.camera[pathKind].points;

    useEffect(() => {
        const next = Math.min(
            Math.max(activePointIndex, 0),
            Math.max(0, points.length - 1)
        );
        if (next !== activePointIndex) onActivePointIndex(next);
    }, [
        activePointIndex,
        onActivePointIndex,
        pathKind,
        points.length,
        shot.id,
    ]);

    if (artwork) {
        const positionSummary = artwork.transform.position
            .map((value) => value.toFixed(1))
            .join(", ");
        const setTransformPart = (
            axis: 0 | 1 | 2,
            value: number,
            kind: "position" | "rotationDeg"
        ) => {
            const next = [...artwork.transform[kind]] as [
                number,
                number,
                number
            ];
            next[axis] = value;
            dispatch(
                {
                    type: "artwork.transform.set",
                    id: operationId("artwork-transform"),
                    source: "user",
                    artworkId: artwork.id,
                    transform: { ...artwork.transform, [kind]: next },
                },
                `Move ${artwork.name}`
            );
        };

        return (
            <aside
                className={shellStyles.inspector}
                aria-label="Artwork inspector"
            >
                <InspectorFrame
                    title={artwork.name}
                    onClose={onClose}
                    actions={
                        <span className={shellStyles.inspectorEyebrow}>
                            Artwork
                        </span>
                    }
                >
                    <div className={styles.content}>
                        <TuneSection
                            title="Source fidelity"
                            icon={<ImageIcon />}
                            summary={
                                artwork.protection === "identity"
                                    ? "Preserve"
                                    : artwork.protection
                            }
                        >
                            <TuneSegmented
                                label="AI treatment"
                                value={artwork.protection}
                                options={[
                                    {
                                        value: "generative",
                                        label: "Creative",
                                    },
                                    { value: "identity", label: "Preserve" },
                                    { value: "exact", label: "Exact" },
                                ]}
                                onChange={(protection) =>
                                    dispatch(
                                        {
                                            type: "artwork.protection.set",
                                            id: operationId("protection"),
                                            source: "user",
                                            artworkId: artwork.id,
                                            protection,
                                        },
                                        "Change artwork fidelity"
                                    )
                                }
                            />
                            <p className={styles.hint}>
                                {artwork.protection === "exact"
                                    ? "Recomposite the source as a protected plate after generation."
                                    : artwork.protection === "identity"
                                    ? "Allow restyling while preserving the artwork's identity."
                                    : "Let the video model reinterpret this artwork freely."}
                            </p>
                        </TuneSection>

                        <TuneSection
                            title="Transform"
                            summary={positionSummary}
                        >
                            {(["X", "Y", "Z"] as const).map((axis, index) => (
                                <TuneNumber
                                    key={axis}
                                    label={`Position ${axis}`}
                                    value={artwork.transform.position[index]}
                                    unit="m"
                                    step={0.1}
                                    onCommit={(value) =>
                                        setTransformPart(
                                            index as 0 | 1 | 2,
                                            value,
                                            "position"
                                        )
                                    }
                                />
                            ))}
                            {(["X", "Y", "Z"] as const).map((axis, index) => (
                                <TuneNumber
                                    key={`rotation-${axis}`}
                                    label={`Rotation ${axis}`}
                                    value={artwork.transform.rotationDeg[index]}
                                    unit="°"
                                    step={1}
                                    onCommit={(value) =>
                                        setTransformPart(
                                            index as 0 | 1 | 2,
                                            value,
                                            "rotationDeg"
                                        )
                                    }
                                />
                            ))}
                        </TuneSection>

                        <div className={styles.destructiveFooter}>
                            <button
                                type="button"
                                onClick={() => {
                                    dispatch(
                                        {
                                            type: "artwork.remove",
                                            id: operationId("remove-artwork"),
                                            source: "user",
                                            artworkId: artwork.id,
                                        },
                                        `Remove ${artwork.name}`
                                    );
                                    onClose();
                                }}
                            >
                                Remove artwork
                            </button>
                        </div>
                    </div>
                </InspectorFrame>
            </aside>
        );
    }

    const activePoint = points[activePointIndex] ?? points[0];

    return (
        <aside className={shellStyles.inspector} aria-label="Camera inspector">
            <InspectorFrame
                title={shot.name}
                onClose={onClose}
                actions={
                    <span className={shellStyles.inspectorEyebrow}>
                        Shot {project.orderedShotIds.indexOf(shot.id) + 1}
                    </span>
                }
            >
                <div className={styles.content}>
                    <TuneSection
                        title="Shot"
                        summary={`${(shot.durationTicks / 30_000).toFixed(1)}s`}
                    >
                        <DeferredText
                            label="Shot name"
                            value={shot.name}
                            maxLength={120}
                            onCommit={(name) =>
                                dispatch({
                                    type: "shot.rename",
                                    id: operationId("rename-shot"),
                                    source: "user",
                                    shotId: shot.id,
                                    name,
                                })
                            }
                        />
                        <DeferredText
                            multiline
                            label="Generation direction"
                            value={shot.prompt}
                            maxLength={12_000}
                            onCommit={(prompt) =>
                                dispatch({
                                    type: "shot.prompt.set",
                                    id: operationId("prompt-shot"),
                                    source: "user",
                                    shotId: shot.id,
                                    prompt,
                                })
                            }
                        />
                    </TuneSection>

                    <TuneSection
                        title="Camera path"
                        icon={<PathIcon />}
                        summary={`${points.length} points`}
                    >
                        <TuneSegmented
                            label="Edit spline"
                            value={pathKind}
                            options={[
                                {
                                    value: "position",
                                    label: "Position",
                                    icon: <PathIcon />,
                                },
                                {
                                    value: "target",
                                    label: "Look at",
                                    icon: <TargetIcon />,
                                },
                            ]}
                            onChange={onPathKind}
                        />
                        <p className={styles.hint}>
                            Drag handles in the canvas. Use these values for
                            exact placement.
                        </p>
                        {points.length <= 6 ? (
                            <TuneSegmented
                                label="Control point"
                                value={String(activePointIndex)}
                                options={points.map((_, index) => ({
                                    value: String(index),
                                    label: String(index + 1).padStart(2, "0"),
                                }))}
                                onChange={(value) =>
                                    onActivePointIndex(Number(value))
                                }
                            />
                        ) : (
                            <TuneSelect
                                label="Control point"
                                value={String(activePointIndex)}
                                options={points.map((_, index) => ({
                                    value: String(index),
                                    label: `Point ${String(index + 1).padStart(
                                        2,
                                        "0"
                                    )}`,
                                }))}
                                onChange={(value) =>
                                    onActivePointIndex(Number(value))
                                }
                            />
                        )}
                        {activePoint
                            ? (["X", "Y", "Z"] as const).map(
                                  (axis, axisIndex) => (
                                      <TuneNumber
                                          key={`${pathKind}-${activePointIndex}-${axis}`}
                                          label={`${axis} coordinate`}
                                          value={activePoint[axisIndex]}
                                          unit="m"
                                          step={0.1}
                                          onCommit={(value) => {
                                              const next = [...activePoint] as [
                                                  number,
                                                  number,
                                                  number
                                              ];
                                              next[axisIndex] = value;
                                              dispatch({
                                                  type: "camera.point.move",
                                                  id: operationId(
                                                      "camera-point"
                                                  ),
                                                  source: "user",
                                                  shotId: shot.id,
                                                  spline: pathKind,
                                                  index: activePointIndex,
                                                  point: next,
                                              });
                                          }}
                                      />
                                  )
                              )
                            : null}
                    </TuneSection>

                    <TuneSection
                        title="Lens & timing"
                        summary={`${shot.camera.focalLengthMm}mm`}
                    >
                        <TuneSlider
                            label="Focal length"
                            value={shot.camera.focalLengthMm}
                            unit="mm"
                            min={12}
                            max={200}
                            step={1}
                            defaultValue={35}
                            onCommit={(focalLengthMm) =>
                                dispatch({
                                    type: "camera.lens.set",
                                    id: operationId("camera-lens"),
                                    source: "user",
                                    shotId: shot.id,
                                    focalLengthMm,
                                })
                            }
                        />
                        <TuneSlider
                            label="Roll"
                            value={shot.camera.rollDeg}
                            unit="°"
                            min={-180}
                            max={180}
                            step={1}
                            defaultValue={0}
                            onCommit={(rollDeg) =>
                                dispatch({
                                    type: "camera.lens.set",
                                    id: operationId("camera-roll"),
                                    source: "user",
                                    shotId: shot.id,
                                    focalLengthMm: shot.camera.focalLengthMm,
                                    rollDeg,
                                })
                            }
                        />
                        <TuneSlider
                            label="Duration"
                            value={shot.durationTicks / 30_000}
                            unit="s"
                            min={1}
                            max={30}
                            step={1 / 30}
                            precision={2}
                            defaultValue={5}
                            onCommit={(seconds) =>
                                dispatch({
                                    type: "shot.duration.set",
                                    id: operationId("shot-duration"),
                                    source: "user",
                                    shotId: shot.id,
                                    durationTicks:
                                        Math.round(seconds * 30) * 1000,
                                })
                            }
                        />
                        <p className={styles.resetHint}>
                            Drag to tune. Click a value for exact entry;
                            double-click it to reset.
                        </p>
                    </TuneSection>
                </div>
            </InspectorFrame>
        </aside>
    );
}
