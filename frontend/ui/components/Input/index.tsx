import { ReactNode, CSSProperties, useState, forwardRef } from "react";
import {
    StypedInput,
    StyledWrapper,
    StyledInputProps,
    StyledWrapperProps,
    StaticText,
} from "./styles";

export type InputProps = StyledInputProps &
    StyledWrapperProps &
    React.InputHTMLAttributes<HTMLInputElement> & {
        style?: CSSProperties;
        children?: ReactNode;
        disabled?: boolean;
        maxLength?: number;
        inputStyle?: CSSProperties;
        staticTextStyle?: CSSProperties;
    };

const Input = forwardRef(
    (
        {
            style,
            children,
            width,
            height,
            icon,
            iconPosition,
            overrideTheme,
            staticText,
            borderWidth,
            inputStyle,
            staticTextStyle,
            ...rest
        }: InputProps,
        ref: React.Ref<HTMLDivElement>
    ) => {
        const [focused, setFocused] = useState(false);

        return (
            <StyledWrapper
                style={style}
                width={width}
                height={height}
                focused={focused}
                staticText={staticText}
                iconPosition={iconPosition}
                overrideTheme={overrideTheme}
                borderColor={rest.borderColor}
                borderWidth={borderWidth || "1px"}
            >
                {staticText ? (
                    <StaticText style={staticTextStyle || {}}>
                        {staticText}
                    </StaticText>
                ) : null}
                <StypedInput
                    {...rest}
                    ref={ref}
                    onFocus={() => setFocused(true)}
                    onBlur={() => setFocused(false)}
                    icon={icon}
                    staticText={staticText}
                    iconPosition={iconPosition}
                    overrideTheme={overrideTheme}
                    style={inputStyle || {}}
                />
                {icon && <div className="icon">{children}</div>}
            </StyledWrapper>
        );
    }
);

Input.defaultProps = {};

export default Input;
