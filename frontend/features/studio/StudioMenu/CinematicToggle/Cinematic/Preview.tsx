import Tag from "@ui/components/Tag";
import Button from "@ui/components/Button";
import Spinner from "@ui/components/Spinner";
import InlineError from "@ui/components/InlineError";
import styled, { css } from "styled-components";
import React, { useEffect, useRef } from "react";
import { Container, Header } from "./shared/styles";
import { useCinematic } from "../../context/CinematicContext";
import { useWorld } from "@components/_3DExhibit-v2/hooks/useWorld";
import { LAYOUT_TYPES } from "@3gl/modules/cinematic/composer/constants";
import { CANVAS } from "@components/_3DExhibit-v2/three/constants";
import { useBoundingclientrectRef } from "@components/hooks/useBoundingclientrectRef";

export default function Preview({ containerRef }) {
    const world = useWorld();

    const {
        step,
        videoFormat,
        cinematicStateLoaded,
        recordFailure,
        //
        play,
        record,
        videoFormatChange,
    } = useCinematic();

    const wrapperRef = useRef<HTMLDivElement>(null);
    const cinematicRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        async function handleResize(e) {
            const canvasRect = CANVAS?.getBoundingClientRect();
            const rect = cinematicRef.current?.getBoundingClientRect();

            if (!world.current || !rect || !canvasRect || !containerRef) return;

            await world.current.setCinematicPreviewSize({
                left: rect.x,
                w: rect.width,
                h: rect.height,
                mode: videoFormat.type,
                bottom: canvasRect.bottom - (rect.y + rect.height),
            });

            dispatchEvent(new Event("resize"));
        }

        containerRef?.current?.addEventListener("scroll", handleResize);

        return () => {
            containerRef?.current?.removeEventListener?.(
                "scroll",
                handleResize
            );
        };
    }, [world?.current, containerRef?.current]);

    useBoundingclientrectRef(
        cinematicRef,
        async (rect) => {
            const canvasRect = CANVAS?.getBoundingClientRect();

            if (
                !rect ||
                !canvasRect ||
                !world.current ||
                !videoFormat?.type ||
                !cinematicStateLoaded
            )
                return;

            if (wrapperRef) {
                const borderWidth = Math.abs(
                    (wrapperRef.current.offsetWidth - videoFormat.width) / 2
                );

                const borderHeight = Math.abs(
                    (wrapperRef.current.offsetHeight - videoFormat.height) / 2
                );

                wrapperRef.current.style.borderTopWidth =
                    borderHeight + 1 + "px";

                wrapperRef.current.style.borderBottomWidth =
                    borderHeight + 1 + "px";

                wrapperRef.current.style.borderLeftWidth = borderWidth + "px";

                wrapperRef.current.style.borderRightWidth = borderWidth + "px";
            }

            await world.current.setCinematicPreviewSize({
                left: rect.x,
                w: rect.width,
                h: rect.height,
                mode: videoFormat.type,
                bottom: canvasRect.bottom - (rect.y + rect.height),
            });

            dispatchEvent(new Event("resize"));
        },
        [
            videoFormat,
            world?.current,
            wrapperRef?.current,
            cinematicStateLoaded,
            cinematicRef?.current,
        ]
    );

    return (
        <Container>
            <Header className="header">
                <h1>Space video preview</h1>
            </Header>
            <Tags className="tags">
                <Tag
                    dot={false}
                    color="#070707"
                    borderRadius="5px"
                    background="#F5F5F5"
                >
                    {videoFormat?.format}
                </Tag>
            </Tags>
            <Cinematic
                ref={(el) => {
                    wrapperRef.current = el;
                }}
            >
                {cinematicStateLoaded ? (
                    <CinematicPreviewSize
                        ref={(el) => {
                            cinematicRef.current = el;
                        }}
                        width={videoFormat?.width}
                        height={videoFormat?.height}
                    />
                ) : (
                    <Loading>
                        <Spinner width={50} isLightTheme />
                    </Loading>
                )}
            </Cinematic>
            <Options>
                <Layouts>
                    <label>
                        Video format ({videoFormat?.type?.toLowerCase?.()})
                    </label>
                    <div>
                        {Object.keys(LAYOUT_TYPES).map((layout, index) => (
                            <div
                                key={index}
                                className={
                                    videoFormat?.type === layout && "active"
                                }
                            >
                                <Format
                                    type={layout}
                                    onClick={() => videoFormatChange(layout)}
                                />
                            </div>
                        ))}
                    </div>
                </Layouts>
                <Tag
                    className="tag"
                    dot={false}
                    color="#070707"
                    borderRadius="5px"
                    background="#F5F5F5"
                >
                    {videoFormat?.format}
                </Tag>
                <Action step={step}>
                    <label>Actions</label>
                    <div>
                        <Button
                            type="button"
                            size="small"
                            bg={"#292929"}
                            title={"Play"}
                            onClick={play}
                            variant="primary"
                            color={"#ffffff"}
                            className="play"
                        />
                        <Button
                            size="small"
                            type="button"
                            icon={<Dot />}
                            title={"Record"}
                            bg={"#ffffff"}
                            variant="primary"
                            onClick={record}
                            color={"#070707"}
                            iconPosition="left"
                            className="record"
                        />
                    </div>
                    <InlineError
                        className="record-failure"
                        message={recordFailure?.message}
                        onRetry={recordFailure?.canRetry ? record : undefined}
                    />
                </Action>
            </Options>
        </Container>
    );
}

const Tags = styled.div`
    width: 100%;
    display: flex;
    height: 60px;
    padding-bottom: 20px;
    align-items: flex-end;
    justify-content: center;
    background: var(--bg-color);
`;

const Cinematic = styled.div`
    width: 100%;
    display: flex;
    height: 390px;
    position: relative;
    border-style: solid;
    align-items: center;
    flex-direction: row;
    justify-content: center;
    background: transrparent;
    border-color: var(--bg-color);

    @media (max-width: 830px) {
        height: calc(100vh - 530px);
    }
`;

const Options = styled.div`
    width: 100%;
    height: auto;
    display: flex;
    padding: 35px;
    background: var(--bg-color);
    align-items: flex-start;
    justify-content: space-between;

    & > .tag {
        display: none;
    }

    @media (max-height: 920px) {
        padding: 18px 35px;

        & > .tag {
            display: inline-flex;
            align-self: flex-end;
        }
    }
`;

const Layouts = styled.div`
    display: flex;
    flex-direction: column;
    align-items: flex-start;

    & > label {
        font-style: normal;
        font-weight: 500;
        font-size: 14px;
        line-height: 24px;
        color: var(--color);
    }

    & > div {
        display: flex;
        margin-top: 8px;
        align-items: center;
        justify-content: flex-start;

        & > div {
            width: 36px;
            height: 36px;
            display: flex;
            margin-right: 8px;
            border-radius: 4px;
            align-items: center;
            justify-content: center;
            border: 1px solid var(--border-color);

            &.active {
                border: 1.5px solid #fff;
            }
        }
    }
`;

const Action = styled.div<{ step: string }>`
    width: ${({ step }) => step !== "preview" && "100%"};
    display: flex;
    align-items: flex-end;
    flex-direction: column;

    & > label {
        font-style: normal;
        font-weight: 500;
        font-size: 14px;
        line-height: 24px;
        color: var(--color);
    }

    & > .record-failure {
        max-width: 260px;
        margin-top: 8px;
    }

    & > div:not(.record-failure) {
        margin-top: 8px;
        display: flex;
        align-items: center;
        flex-wrap: nowrap;

        & > button {
            font-style: normal;
            font-weight: 400;
            font-size: 14px;
            line-height: 24px;
            text-align: center;

            &.play {
                width: 65px;
                padding: 0px;
                height: 36px;
                margin-right: 9px;
                border-radius: 100px;
                border: 1px solid var(--border-color);
            }

            &.record {
                width: 98px;
                height: 36px;
                display: flex;
                padding: 0px 10px;
                align-items: center;
                border-radius: 100px;
                justify-content: center;
            }
        }
    }
`;

const Format = styled.div<{ type: string }>`
    border-radius: 2px;
    background: #ffffff;

    ${(props) =>
        props.type === LAYOUT_TYPES.SQUARE
            ? css`
                  width: 24px;
                  height: 24px;
                  border: none;
              `
            : props.type === LAYOUT_TYPES.LANDSCAPE
            ? css`
                  width: 27px;
                  height: 15px;
                  border: 1px solid #ffffff;
              `
            : css`
                  width: 15px;
                  height: 27px;
              `}
`;

const Dot = styled.div`
    width: 12px;
    height: 12px;
    margin-right: 4px;
    border-radius: 50%;
    background: #ff5b58;
`;

const Loading = styled.div`
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--bg-color);
`;

const CinematicPreviewSize = styled.div<{
    width: number;
    height: number;
}>`
    border-radius: 8px;
    outline: 6px solid var(--bg-color);
    width: ${({ width }) => width + "px"};
    height: ${({ height }) => height + "px"};
`;
