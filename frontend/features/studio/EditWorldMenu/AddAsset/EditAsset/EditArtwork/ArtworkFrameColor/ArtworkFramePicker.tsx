import { useState } from "react";
import styled, { css } from "styled-components";
import { Field } from "@features/studio/styles/Field";
import { Label } from "@features/studio/styles/Label";
import Slider from "@features/studio/styles/Slider";
import { Toggle } from "@features/studio/components/Toggle";
import { studioAction } from "@features/studio/styles/primitives";
import { studioTokens as studio } from "@styles/tokens";
import { tx } from "@components/context/I18nContext";
import {
    ArtworkFrame,
    GALLERY_FRAME_COLORS,
    GALLERY_FRAME_DEFAULTS,
    GALLERY_FRAME_LIMITS,
    GALLERY_MAT_COLORS,
    normalizeFrame,
} from "@components/_3DExhibit-v2/three/factory/border/galleryFrame";

const colors = ["#020202", "#5D4E43", "#CBA781"];

const HEX = /^#[a-f0-9]{6}$/i;

export interface ArtworkFramePickerProps {
    /** The artwork's `borderColor`. */
    value?: string;
    /** The artwork's frame style; null or absent for the flat border. */
    frame?: ArtworkFrame | null;
    disabled?: boolean;
    /** Gallery frames only fit flat media (images, videos, panoramas). */
    allowGallery?: boolean;
    /** The artwork has a title a wall label can show. */
    hasLabelText?: boolean;
    onChange: (color: string) => void;
    /** Save a new frame style (null: back to the flat border). */
    onFrameChange?: (frame: ArtworkFrame | null, color: string) => void;
    /** Show a frame while a slider is dragged, without saving it. */
    onFramePreview?: (frame: ArtworkFrame) => void;
}

export function ArtworkFramePicker({
    value = "black-borderless",
    frame = null,
    disabled = false,
    allowGallery = false,
    hasLabelText = false,
    onChange,
    onFrameChange,
    onFramePreview,
}: ArtworkFramePickerProps) {
    // Values being dragged: the sliders are controlled, so they show these
    // until the drag ends and the frame is saved.
    const [draft, setDraft] = useState<Partial<ArtworkFrame>>({});

    const saved = allowGallery ? normalizeFrame(frame) : null;

    const gallery = saved ? { ...saved, ...draft } : null;

    const swatches = gallery ? GALLERY_FRAME_COLORS : colors;

    const isSwatch = (color: string) =>
        swatches.some((it) => it.toLowerCase() === color?.toLowerCase());

    const chooseStyle = (style: "flat" | "gallery") => {
        if (style === "gallery" && !gallery) {
            // A frame needs a colour: keep a chosen one, else near-black.
            const color = HEX.test(value) ? value : GALLERY_FRAME_COLORS[0];
            onFrameChange?.({ ...DEFAULT_GALLERY_FRAME }, color);
        } else if (style === "flat" && gallery) {
            onFrameChange?.(null, value);
        }
    };

    const update = (patch: Partial<ArtworkFrame>, preview = false) => {
        const next = { ...gallery, ...patch };
        if (preview) {
            setDraft((it) => ({ ...it, ...patch }));
            onFramePreview?.(next);
        } else {
            setDraft({});
            onFrameChange?.(next, value);
        }
    };

    const slider = (key: "width" | "depth" | "matWidth", factor: number) => ({
        min: Math.round(GALLERY_FRAME_LIMITS[key][0] * factor),
        max: Math.round(GALLERY_FRAME_LIMITS[key][1] * factor),
        value: Math.round(gallery[key] * factor),
        onChange: (raw: number, isDragging: boolean) => {
            const [min, max] = GALLERY_FRAME_LIMITS[key];
            const v = Math.min(max, Math.max(min, raw / factor));
            update({ [key]: v }, isDragging);
        },
    });

    return (
        <Field>
            {allowGallery ? (
                <>
                    <Label className="component-label" id="frame-style-label">
                        {tx("Frame style")}
                    </Label>
                    <Segmented role="group" aria-labelledby="frame-style-label">
                        {(
                            [
                                ["flat", tx("Flat")],
                                ["gallery", tx("Gallery")],
                            ] as const
                        ).map(([style, title]) => {
                            const selected =
                                style === "gallery" ? !!gallery : !gallery;
                            return (
                                <SegmentButton
                                    key={style}
                                    type="button"
                                    aria-pressed={selected}
                                    disabled={disabled}
                                    $selected={selected}
                                    onClick={() => chooseStyle(style)}
                                >
                                    {title}
                                </SegmentButton>
                            );
                        })}
                    </Segmented>
                </>
            ) : null}

            <Label className="component-label">
                {gallery ? tx("Frame color") : tx("Select Frame")}
            </Label>
            <BorderWrapper>
                <Colors style={{ padding: 0 }}>
                    {[
                        ...(gallery
                            ? []
                            : [
                                  [
                                      "black-borderless",
                                      "Black backing, no frame",
                                  ],
                                  [
                                      "transparent-borderless",
                                      "Transparent, no frame",
                                  ],
                              ]),
                        ...swatches.map((color) => [color, `Frame ${color}`]),
                    ].map(([color, label]) => (
                        <ColorCircle
                            key={color}
                            type="button"
                            aria-label={label}
                            aria-pressed={
                                value?.toLowerCase() === color.toLowerCase()
                            }
                            disabled={disabled}
                            selected={
                                value?.toLowerCase() === color.toLowerCase()
                            }
                            color={color}
                            onClick={() => onChange(color)}
                        />
                    ))}
                    <ColorCircle
                        as="label"
                        selected={!isSwatch(value) && HEX.test(value)}
                        color="wheel"
                    >
                        <input
                            aria-label={tx("Custom frame color")}
                            style={{
                                opacity: 0,
                                width: "100%",
                                height: "100%",
                                cursor: disabled ? "default" : "pointer",
                            }}
                            type="color"
                            disabled={disabled}
                            value={HEX.test(value) ? value : "#ffffff"}
                            onChange={(event) => onChange(event.target.value)}
                        />
                    </ColorCircle>
                </Colors>
            </BorderWrapper>

            {gallery ? (
                <GalleryControls data-testid="gallery-frame-controls">
                    <Label className="component-label">
                        {tx("Frame width")}
                    </Label>
                    <Slider
                        {...slider("width", 1)}
                        disabled={disabled}
                        mode="dark"
                    />

                    <Label className="component-label">
                        {tx("Frame depth")}
                    </Label>
                    <Slider
                        {...slider("depth", 100)}
                        disabled={disabled}
                        mode="dark"
                    />

                    <Row>
                        <Label className="component-label">{tx("Mat")}</Label>
                        <Toggle
                            label={tx("Mat")}
                            value={gallery.mat}
                            disabled={disabled}
                            onChange={(mat) => update({ mat })}
                        />
                    </Row>

                    {gallery.mat ? (
                        <>
                            <Label className="component-label">
                                {tx("Mat width")}
                            </Label>
                            <Slider
                                {...slider("matWidth", 1)}
                                disabled={disabled}
                                mode="dark"
                            />

                            <Label className="component-label">
                                {tx("Mat color")}
                            </Label>
                            <BorderWrapper>
                                <Colors style={{ padding: 0 }}>
                                    {GALLERY_MAT_COLORS.map((color) => (
                                        <ColorCircle
                                            key={color}
                                            type="button"
                                            aria-label={`Mat ${color}`}
                                            aria-pressed={
                                                gallery.matColor === color
                                            }
                                            disabled={disabled}
                                            selected={
                                                gallery.matColor === color
                                            }
                                            color={color}
                                            onClick={() =>
                                                update({ matColor: color })
                                            }
                                        />
                                    ))}
                                    <ColorCircle
                                        as="label"
                                        selected={
                                            !GALLERY_MAT_COLORS.includes(
                                                gallery.matColor
                                            )
                                        }
                                        color="wheel"
                                    >
                                        <input
                                            aria-label={tx("Custom mat color")}
                                            style={{
                                                opacity: 0,
                                                width: "100%",
                                                height: "100%",
                                                cursor: disabled
                                                    ? "default"
                                                    : "pointer",
                                            }}
                                            type="color"
                                            disabled={disabled}
                                            value={gallery.matColor}
                                            onChange={(event) =>
                                                update({
                                                    matColor:
                                                        event.target.value,
                                                })
                                            }
                                        />
                                    </ColorCircle>
                                </Colors>
                            </BorderWrapper>
                        </>
                    ) : null}

                    <Row>
                        <Label className="component-label">
                            {tx("Wall label")}
                        </Label>
                        <Toggle
                            label={tx("Wall label")}
                            value={gallery.label && hasLabelText}
                            disabled={disabled || !hasLabelText}
                            onChange={(label) => update({ label })}
                        />
                    </Row>
                    {!hasLabelText ? (
                        <Hint>
                            {tx("Give the artwork a title to show a label.")}
                        </Hint>
                    ) : null}
                </GalleryControls>
            ) : null}
        </Field>
    );
}

/** A new gallery frame with the default settings. */
export const DEFAULT_GALLERY_FRAME: ArtworkFrame = {
    style: "gallery",
    width: GALLERY_FRAME_DEFAULTS.width,
    depth: GALLERY_FRAME_DEFAULTS.depth,
    mat: GALLERY_FRAME_DEFAULTS.mat,
    matWidth: GALLERY_FRAME_DEFAULTS.matWidth,
    matColor: GALLERY_FRAME_DEFAULTS.matColor,
    label: GALLERY_FRAME_DEFAULTS.label,
};

const Segmented = styled.div`
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 4px;
    padding: 3px;
    border: 1px solid var(--studio-line, ${studio.color.line});
    border-radius: var(--studio-radius-control, ${studio.radius.control}px);
    background: var(--studio-inset, ${studio.color.inset});
`;

const SegmentButton = styled.button<{ $selected: boolean }>`
    ${studioAction}
    min-height: 32px;
    padding: 4px ${studio.action.paddingX}px;
    border-radius: ${studio.radius.compact}px;
    color: ${({ $selected }) =>
        $selected
            ? `var(--studio-ink, ${studio.color.ink})`
            : `var(--studio-muted, ${studio.color.muted})`};
    background: ${({ $selected }) =>
        $selected
            ? `var(--studio-selected, ${studio.color.selected})`
            : "transparent"};
`;

const GalleryControls = styled.div`
    display: flex;
    flex-direction: column;
    gap: ${studio.space.fieldGap}px;
`;

const Row = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-height: 32px;
`;

const Hint = styled.div`
    font: ${studio.font.label} var(--studio-font, ${studio.font.sans});
    color: var(--studio-muted, ${studio.color.muted});
    margin-top: -6px;
`;

const BorderWrapper = styled.div`
    padding: 4px 5px;
    & > div {
        display: flex;
        align-items: center;
        justify-content: flex-start;
        gap: 6px;
    }

    @media (max-width: 600px) {
        padding: 0;
        padding-left: 4px;
    }
`;

const Colors = styled.div`
    @media (max-width: 600px) {
        display: flex;
    }
`;

const ColorCircle = styled.button<{
    selected: boolean;
    color: string;
}>`
    width: 35px;
    height: 35px;
    min-width: 35px;
    min-height: 35px;
    cursor: pointer;

    ${({ color }) => {
        if (color === "black-borderless") {
            return css`
                background: linear-gradient(
                        to top left,
                        rgba(0, 0, 0, 0) 0%,
                        rgba(0, 0, 0, 0) calc(50% - 0.8px),
                        rgba(0, 0, 0, 1) 50%,
                        rgba(0, 0, 0, 0) calc(50% + 0.8px),
                        rgba(0, 0, 0, 0) 100%
                    ),
                    linear-gradient(
                        to top right,
                        rgba(0, 0, 0, 0) 0%,
                        rgba(0, 0, 0, 0) calc(50% - 0.8px),
                        rgba(0, 0, 0, 1) 50%,
                        rgba(0, 0, 0, 0) calc(50% + 0.8px),
                        rgba(0, 0, 0, 0) 100%
                    );
            `;
        } else if (color === "wheel") {
            return css`
                background: url(/images/color_wheel.png);
                background-size: 118%;
                background-position: center;
            `;
        } else if (color === "transparent-borderless") {
            return css`
                background: url(/images/checker.png);
                background-size: contain;
            `;
        } else {
            return css`
                background: ${color};
            `;
        }
    }}
    border: ${(props) =>
        props.selected ? "2px solid #ffffff" : "1px solid #ececec"};

    transform: ${(props) => (props.selected ? "scale(1.1)" : "none")};

    padding: 1px;
    border-radius: 35px;
    margin-right: 2px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    @media (max-width: 600px) {
        width: 24px;
        height: 24px;
    }
`;
