import React, { forwardRef, CSSProperties } from "react";
import { StyledProgressBar, StyledProgressBarProps } from "./styles";

type ProgressBarProps = StyledProgressBarProps &
    React.HTMLAttributes<HTMLDivElement> & {
        style?: CSSProperties;
    };

const ProgressBar = forwardRef(
    (props: ProgressBarProps, ref: React.Ref<HTMLDivElement>) => (
        <StyledProgressBar ref={ref} {...props} />
    )
);

ProgressBar.defaultProps = {};

export default ProgressBar;
