import styled from "styled-components";
import React, { useRef } from "react";
import { Floatbar } from "../shared/Floatbar";
import { RoundButton } from "@components/DesignSystem/buttons";
import ReactDOM from "react-dom";

export type Props = {
    title: string;
    info?: React.ReactNode;
    children?: React.ReactNode;
    onSubmit?: (_) => unknown;
    onCancel?: (_) => unknown;
    submitAction?: string;
    style?: React.CSSProperties;
};

export function Panel({
    title,
    info,
    onSubmit,
    onCancel,
    submitAction,
    children,
    style,
}: Props) {
    //

    return ReactDOM.createPortal(
        <Floatbar style={style} header={title} className="floatbar">
            {info != null ? info : null}
            <Body className="scrollbar-hidden">{children}</Body>

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
                            {submitAction || "Submit"}
                        </RoundButton>
                    </div>
                )}
            </Footer>
        </Floatbar>,

        document.body
    );
}

const Body = styled.div`
    width: 100%;
    overflow-y: scroll;
    overflow-x: hidden;
    padding: 10px 20px 0px 10px;
    max-height: calc(90vh - 180px);

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
