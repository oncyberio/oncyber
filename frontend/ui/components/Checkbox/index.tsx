import React, { forwardRef, CSSProperties } from "react";
import { StyledCheckbox, StyledCheckboxProps } from "./styles";

type CheckboxProps = StyledCheckboxProps &
    React.HTMLAttributes<HTMLInputElement> & {
        style?: CSSProperties;
    };

const Checkbox = forwardRef(
    (props: CheckboxProps, ref: React.Ref<HTMLInputElement>) => (
        <StyledCheckbox ref={ref} type="checkbox" {...props} />
    )
);

Checkbox.defaultProps = {};

export default Checkbox;
