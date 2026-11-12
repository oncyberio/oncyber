import React, { forwardRef, ReactNode, CSSProperties } from "react";
import { StyledTag, StyledTagProps } from "./styles";

type TagProps = StyledTagProps &
    React.HTMLAttributes<HTMLSpanElement> & {
        style?: CSSProperties;
        children: ReactNode;
        dot?: boolean;
    };

const Tag = forwardRef((props: TagProps, ref: React.Ref<HTMLSpanElement>) => (
    <StyledTag ref={ref} {...props}>
        {props.children}
        {props.dot && <span />}
    </StyledTag>
));

Tag.defaultProps = {
    dot: true,
};

export default Tag;
