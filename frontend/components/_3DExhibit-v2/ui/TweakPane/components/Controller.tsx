import React from "react";
import { noop } from "@utils/js";
import { Controls } from "../constants";
import styled, { css } from "styled-components";
import { CINEMATIC } from "@components/_3DExhibit-v2/three/constants";

export default function Controller({ controller }) {
    const { settings, updateDisplays } = controller;

    const label = settings?.label || settings?.propName || "unknown";
    const type = settings.componentType;
    const Component = Controls[type] as any;

    const props = {
        ...settings,
        inputRef: (element) => {
            if (element) {
                controller.dom.add(element);
                controller.currentDomElement = element;
            }
        },
        updateDisplays,
        label,
    };

    const isFileInput = type === "FileInput";

    return (
        <Container>
            {!isFileInput && <span>{label}</span>}
            <div
                className="controller-wrapper"
                style={!isFileInput ? { marginLeft: "8px" } : {}}
            >
                <Component {...props} />
            </div>
        </Container>
    );
}

Controller.defaultProps = {
    updateDisplays: noop,
    settings: {},
};

const Container = styled.div`
    display: flex;
    height: 25px;
    gap: 8px;
    flex-wrap: nowrap;
    flex-direction: row;
    align-items: center;
    padding: 10px 0px 10px 10px;
    justify-content: space-between;

    & > span {
        ${(props) =>
            CINEMATIC
                ? css`
                      width: 100%;
                  `
                : css`
                      width: 90%;
                  `}

        font-weight: 400;
        font-size: 12px;
        line-height: 24px;
        color: #777980;
        overflow: hidden;
        white-space: nowrap;
        text-transform: capitalize;
    }

    & > .controller-wrapper {
        width: 100%;
    }
`;
