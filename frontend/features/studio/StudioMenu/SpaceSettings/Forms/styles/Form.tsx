import { studioField } from "@features/studio/styles/primitives";
import { Field } from "@features/studio/styles/Field";
import { Label } from "@features/studio/styles/Label";
import styled, { css } from "styled-components";

export const Form = styled(Field)`
    gap: 6px;

    .timepicker_container {
        input {
            ${studioField}
            font-weight: 400;
            line-height: 24px;
            font-style: normal;
            width: 100%;
            outline: none;
            box-sizing: border-box;
            background: transparent;
            padding: 7px 8px;
            border: none;
            font-size: 14px;
            border-radius: 8px;
            color: #c0c0c6;
            background: var(--studio-surface);
        }
    }

    .react-datepicker__header--time {
        display: none;
    }
`;

export const FormError = styled.span`
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    font-weight: 400;
    font-size: 13px;
    line-height: 20px;
    color: #ed8585;
`;

export const FormLabelWrapper = styled.div`
    display: flex;
    flex-direction: row;
    align-items: baseline;
    justify-content: space-between;
    gap: 24px;
`;

export const FormLabel = styled(Label)``;

export const FormLabelAction = styled.div<{ disabled?: boolean }>`
    background: none;
    font-style: normal;
    font-weight: 400;
    font-size: 14px;
    text-decoration-line: underline;
    color: #f1f1f7;
    cursor: pointer;

    ${(props) =>
        props.disabled
            ? css`
                  pointer-events: none;
                  cursor: not-allowed;
                  opacity: 0.5;
              `
            : ""}
`;

export const FormInfo = styled.p`
    margin: 0;
    max-width: 70%;
    font-style: normal;
    font-weight: 400;
    font-size: 14px;
    color: #f1f1f7;
`;

export const FormSep = styled.div`
    width: 100%;
    border-top: 1px solid var(--studio-line);
    margin: 24px 0;
`;
