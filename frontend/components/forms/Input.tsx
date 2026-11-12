import UIInput, { InputProps as UIInputProps } from "@ui/components/Input";
import React from "react";

export interface InputProps extends UIInputProps {
    hasError?: boolean;
}

export function Input(props: InputProps) {
    return (
        <UIInput
            icon={React.Children.count(props.children) > 0}
            iconPosition="right"
            width="100%"
            height="40px"
            borderRadius="6px"
            overrideTheme="light"
            style={{ marginTop: "6px" }}
            borderColor={props.hasError ? "orange" : ""}
            color="#000"
            background="#FFFFFF"
            {...props}
        />
    );
}
