import { UtilityRow } from "@features/content-host/NativeVisitorPanel";
import { useEventCallback } from "@components/hooks/useEventCallback";
import { useCurrentExhibit } from "@features/studio/context/ExhibitContext";
import IconImg from "@ui/components/IconImg";
import { useMemo } from "react";
import styled from "styled-components";
import { usePanel } from "../context/PanelProvider";
import { useMultiplayer } from "@components/_3DExhibit-v2/context/MultiplayerProvider";
import { classes } from "@utils/js";
import { useMediaPlaceholders } from "../shared/useMediaPlaceholders";

export default function SelectMediaPlaceholder({ embedded = false }) {
    //

    const { setCurrentTab } = usePanel();

    const { voice } = useMultiplayer();

    const { voiceState, voiceUsers, togglePlaying, updateMediaPlaceholder } =
        voice;

    const { placeholders, placeholdersInUse, freePlaceholder } =
        useMediaPlaceholders();

    const handleSelectPlacehodler = useEventCallback((placeholderId) => {
        //
        if (placeholdersInUse[placeholderId]) return;

        setCurrentTab("");

        if (
            voiceState.type === "enabled" &&
            voiceState.state.videoStreamState?.hasVideo
        ) {
            //
            updateMediaPlaceholder({ id: placeholderId });
        } else {
            //
            togglePlaying(true, { placeholderId });
        }
        //
    }, []);

    return (
        <MPContainer>
            {!embedded && (
                <div className="mp-header">
                    <h1>Select broadcast place</h1>
                    <IconImg
                        className="mp-icon"
                        name="x"
                        size={16}
                        style={{ filter: "invert(1)" }}
                        onClick={() => setCurrentTab("")}
                    />
                </div>
            )}
            <div className="mp-body">
                <MPlaceholder
                    key={freePlaceholder.id}
                    used={placeholdersInUse[freePlaceholder.id]}
                    placeholder={freePlaceholder}
                    onClick={() => handleSelectPlacehodler(null)}
                >
                    <IconImg
                        name="maximize-2"
                        size={16}
                        style={{
                            filter: "invert(1)",
                            position: "absolute",
                            bottom: 6,
                            right: 6,
                        }}
                    />
                </MPlaceholder>
                {placeholders.map((placeholder) => (
                    <MPlaceholder
                        key={placeholder.id}
                        used={placeholdersInUse[placeholder.id]}
                        placeholder={placeholder}
                        onClick={handleSelectPlacehodler}
                    />
                ))}
            </div>
        </MPContainer>
    );
}

export function MPlaceholder({
    placeholder,
    used,
    children,
    onClick,
}: {
    placeholder: any;
    used?: boolean;
    children?: React.ReactNode;
    onClick?: (placeholder: any) => unknown;
}) {
    //

    const style = {
        width: placeholder.width,
        height: placeholder.height,
        borderColor: placeholder.color ?? "#ffffff",
    };

    return (
        <MPlaceholderContainer
            type="button"
            disabled={!!used}
            aria-label={`${placeholder.name}${used ? " — in use" : ""}`}
            className={classes({ "mp-used": used })}
            onClick={() => onClick(placeholder.id)}
        >
            <div className="mp-preview">
                <div className="mp-preview-border" style={style}>
                    {children ?? null}
                </div>
            </div>
            <div className="mp-name">{placeholder.name}</div>
            {used && (
                <IconImg
                    className="mp-used-icon"
                    name="check-white-bg"
                    size={16}
                />
            )}
        </MPlaceholderContainer>
    );
}

const MPContainer = styled.div`
    /* width: 271px;
    height: 267px;
    background: rgba(7, 7, 7, 0.6); */
    color: #ffffff;

    padding: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 24px;

    & > .mp-header {
        width: 100%;
        flex: 1;

        display: flex;
        flex-direction: row;
        align-items: center;

        & > h1 {
            font-weight: 500;
            font-size: 14px;
            line-height: 28px;
            color: #ffffff;
            margin: 0;
            user-select: none;
        }

        & > .mp-icon {
            cursor: pointer;
            flex: 0;
            margin-left: auto;
        }
    }

    & > .mp-body {
        width: 100%;
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 16px;
        align-items: flex-start;
        justify-content: center;
    }
`;

const MPlaceholderContainer = styled(UtilityRow)`
    width: 100%;
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 12px;
    cursor: pointer;

    &:hover {
        & > .mp-preview {
            & > .mp-preview-border {
                background-color: rgba(255, 255, 255, 0.2);
            }
        }
    }

    &.mp-used {
        opacity: 0.3;
        pointer-events: none;
        cursor: not-allowed;

        & > .mp-preview {
            & > .mp-preview-border {
                background-color: rgba(255, 255, 255, 0.2);
            }
        }
    }

    & > .mp-preview {
        flex: 0 0 59px;
        display: flex;
        justify-content: center;

        & > .mp-preview-border {
            position: relative;
            border: 2px solid #ffffff;
            border-radius: 8px;
        }
    }

    & > .mp-name {
        flex: 1;
        font-weight: 400;
        font-size: 12px;
        line-height: 20px;
        color: #ffffff;

        user-select: none;
    }

    & > .mp-used-icon {
        flex: 0;
        margin-left: auto;
    }
`;
