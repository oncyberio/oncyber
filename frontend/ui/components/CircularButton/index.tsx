import { CircularButtonWrapper } from "./style";
import { forwardRef } from "react";

export const CircularButton = forwardRef((props: any, ref) => {
    return <CircularButtonWrapper {...props} ref={ref} />;
});

export default CircularButton;
