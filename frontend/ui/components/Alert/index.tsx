import React, { forwardRef, ReactNode, CSSProperties } from "react";
import { StyledAlert, StyledAlertProps } from "./styles";

type AlertProps = StyledAlertProps &
    React.HTMLAttributes<HTMLDivElement> & {
        style?: CSSProperties;
        children: ReactNode;
    };

const Alert = forwardRef(
    (props: AlertProps, ref: React.Ref<HTMLDivElement>) => (
        <StyledAlert ref={ref} {...props}>
            {props.children}
        </StyledAlert>
    )
);

Alert.defaultProps = {};

export default Alert;
