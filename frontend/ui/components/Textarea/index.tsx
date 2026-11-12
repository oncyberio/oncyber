import React, { forwardRef, ReactNode, CSSProperties } from "react";
import { StyledTextarea, StyledTextareaProps } from "./styles";

type TextareaProps = StyledTextareaProps &
    React.HTMLAttributes<HTMLTextAreaElement> & {
        style?: CSSProperties;
    };

const Textarea = forwardRef(
    (props: TextareaProps, ref: React.Ref<HTMLTextAreaElement>) => (
        <StyledTextarea ref={ref} {...props}></StyledTextarea>
    )
);

Textarea.defaultProps = {};

export default Textarea;
