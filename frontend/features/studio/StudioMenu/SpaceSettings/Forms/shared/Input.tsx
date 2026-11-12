import UIInput, { InputProps as UIInputProps } from "@ui/components/Input";
import React from "react";

export interface InputProps extends UIInputProps {
    hasError?: boolean;
}

const staticTextStyle: React.CSSProperties = {
    fontWeight: 400,
    fontSize: "13px",
    lineHeight: "24px",
    color: "var(--studio-secondary)",
    background: "var(--studio-inset)",
    borderRadius:
        "var(--studio-radius-control) 0 0 var(--studio-radius-control)",
};

export function Input(props: InputProps) {
    return (
        <UIInput
            borderColor={
                props.hasError ? "#ed8585" : "var(--studio-line, #303035)"
            }
            icon={React.Children.count(props.children) > 0}
            iconPosition="right"
            width="100%"
            height="40px"
            fontSize="13px"
            padding="7px 8px"
            background="var(--studio-inset)"
            borderRadius={props.staticText ? "0 10px 10px 0" : "10px"}
            color="var(--studio-ink, #f2f2f3)"
            staticTextStyle={staticTextStyle}
            {...props}
            style={{
                borderRadius: "var(--studio-radius-control)",
                background: "var(--studio-inset)",
                ...props.style,
            }}
        />
    );
}
