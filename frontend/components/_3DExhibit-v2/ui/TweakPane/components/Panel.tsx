import GUI from "../gui";
import Folder from "./Folder";
import Control from "./Controller";
import { GUIParams } from "../types";
import styled from "styled-components";
import { isObjEmpty, noop } from "@utils/js";
import { Controller } from "../gui/controller";
import React, { useEffect, useRef, useState } from "react";
import { FolderTab, FolderBtn } from "./Folder/styles";
import { RoundButton } from "@components/DesignSystem/buttons";
import { Floatbar } from "./Floatbar";

export type Props = {
    params: GUIParams;
    btnName?: string;
    shouldRender?: boolean;
    listens: Array<Controller>;
    style?: React.CSSProperties;
    folders: Record<string, any>;
    onCancel?: React.MouseEventHandler<HTMLButtonElement>;
    onSubmit?: React.MouseEventHandler<HTMLButtonElement>;
};

function RenderGUI({ gui }) {
    const { params, folders } = gui;
    const grouped = params?.grouped;

    if (Object.keys(folders).length === 0) {
        return null;
    }

    if (grouped) {
        const folderArray = Object.values(folders);
        const folderTabs = folderArray.map((item: any, index: number) => {
            const isVisible = item?.visible;

            return (
                <FolderBtn
                    key={index}
                    isActive={isVisible}
                    onClick={() => item.setVisible(!isVisible)}
                >
                    {item?.params?.name}
                </FolderBtn>
            );
        });

        const folderContent = folderArray.map((item: any) => {
            const isVisible = item?.visible;

            return isVisible && <RenderChildren items={item.folders} />;
        });

        return (
            <Folder title={params.name} gui={gui}>
                <FolderTab>{folderTabs}</FolderTab>
                {folderContent}
            </Folder>
        );
    }

    return (
        <Folder title={params.name} gui={gui}>
            <RenderChildren items={folders} />
        </Folder>
    );
}

function RenderChildren({ items }) {
    return (
        <>
            {Object.entries(items)?.map(([key, value]) => {
                if (value instanceof GUI) {
                    const visible = value?.visible;
                    return visible && <RenderGUI gui={value} key={key} />;
                } else if (value instanceof Controller) {
                    const visible = value?.settings?.visible;
                    return visible && <Control controller={value} key={key} />;
                }
                return null;
            })}
        </>
    );
}

export function Panel({
    onSubmit,
    onCancel = noop,
    folders = {},
    listens,
    btnName = "Upload",
    style = {},
    params,
}: Props) {
    const title = params.name;
    const width = params?.width || 400;

    const containerRef = useRef<HTMLDivElement>();

    const [, forceUpdate] = useState<boolean>(false);

    useEffect(() => {
        let raf = 0;
        const update = () => {
            raf = requestAnimationFrame(update);
            // update controllers.
            listens.forEach((controller) => {
                controller.updateDisplays();
            });

            if (GUI.needsUpdate) {
                forceUpdate((prev) => !prev);
                GUI.needsUpdate = false;
            }
        };
        raf = requestAnimationFrame(update);
        return () => {
            cancelAnimationFrame(raf);
        };
    }, []);

    return (
        <Container
            width={width}
            style={{ ...params?.position, ...style }}
            ref={containerRef}
        >
            <Floatbar header={title} className="floatbar">
                <Body className="scrollbar-hidden">
                    {isObjEmpty(folders) ? (
                        <Error>
                            <span>
                                An error has occurred. Please refresh and try
                                again
                            </span>
                        </Error>
                    ) : (
                        <RenderChildren items={folders} />
                    )}
                </Body>

                <Footer>
                    {onSubmit && (
                        <div>
                            <RoundButton
                                isLight={true}
                                className="cancel"
                                onClick={onCancel}
                            >
                                Cancel
                            </RoundButton>
                            <RoundButton className="submit" onClick={onSubmit}>
                                {btnName}
                            </RoundButton>
                        </div>
                    )}
                </Footer>
            </Floatbar>
        </Container>
    );
}

Panel.defaultProps = {
    style: {},
    folders: {},
    onCancel: noop,
    btnName: "Upload",
};

const Container = styled.div<{ width?: number; isHidden?: boolean }>`
    //

    & > .floatbar {
        width: 100%;
        user-select: none;
        overflow: hidden;
        border-radius: 8px;
        background: #1e1e1e;

        transform: translate(
            calc(100vw - ${(props) => props.width}px - 25px),
            90px
        );

        width: ${({ width }) => `${width}px`};
        ${({ isHidden }) => isHidden && "display: none"};

        box-shadow: 0px 2px 4px rgba(0, 0, 0, 0.15),
            0px 12px 28px rgba(0, 0, 0, 0.11);
    }
`;

const Body = styled.div`
    width: 100%;
    overflow-y: scroll;
    overflow-x: hidden;
    padding: 10px 20px 0px 10px;
    max-height: calc(90vh - 180px);
    display: flex;
    flex-direction: column;
    gap: 8px;

    & > div:not(:last-child) {
        padding-bottom: 8px;
        border-bottom: 1px solid #292929;
    }
`;

const Footer = styled.div`
    width: 100%;
    padding: 16px;

    & > div {
        width: 100%;
        padding: 15px 0 0 0;
        display: flex;
        align-items: center;
        justify-content: space-between;
        border-top: 1px solid #292929;

        & > button {
            cursor: pointer;
            font-weight: 500;
            font-size: 12px;
            line-height: 24px;
            display: flex;
            align-items: center;
            border-radius: 200px;

            &.cancel {
                color: #ffffff;
                background: transparent;
                border: 1px solid #292929;
            }
        }
    }
`;

const Error = styled.div`
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;

    & > span {
        color: #fff;
        text-align: center;
        font-size: 12px;
        line-height: 140%;
        padding: 10px;
        padding-bottom: 0;
    }
`;
