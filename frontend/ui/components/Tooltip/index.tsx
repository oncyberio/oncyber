import React, {
    forwardRef,
    CSSProperties,
    ReactNode,
    useState,
    useRef,
} from "react";
import { StyledTooltipProps, Container } from "./styles";
import Portal from "@components/Snackbar/Portal";
import { IS_MOBILE } from "@components/_3DExhibit-v2/three/constants";

type TooltipProps = StyledTooltipProps &
    React.HTMLAttributes<HTMLDivElement> & {
        text: string;
        children: ReactNode;
        style?: CSSProperties;
        gap?: number;
    };

const Tooltip = forwardRef(
    (
        { orientation, children, text, gap = 10 }: TooltipProps,
        ref: React.Ref<HTMLSpanElement>
    ) => {
        const [coords, setCoords] = useState({ left: 0, top: 0 });
        const [showTooltip, setShowTooltip] = useState(false);

        const elRef = useRef<HTMLDivElement>(null);

        const mouseEnter = (e) => {
            if (!elRef.current) return;

            const {
                top: elTop,
                left: elLeft,
                height: elHeight,
                width: elWidth,
            } = e.target.getBoundingClientRect();

            const { width: tooltipWidth, height: tooltipHeight } =
                elRef.current.getBoundingClientRect();

            let correctedLeft = elLeft;
            let correctedTop = elTop;

            switch (orientation) {
                case "top": {
                    correctedLeft =
                        correctedLeft + elWidth / 2 - tooltipWidth / 2;
                    correctedTop = correctedTop - gap - tooltipHeight;
                    break;
                }
                case "left": {
                    correctedLeft = elLeft - gap - tooltipWidth;
                    correctedTop =
                        correctedTop + elHeight / 2 - tooltipHeight / 2;
                    break;
                }
                case "right": {
                    correctedLeft = correctedLeft + elWidth + gap;
                    correctedTop =
                        correctedTop + elHeight / 2 - tooltipHeight / 2;
                    break;
                }
                case "bottom":
                    correctedLeft =
                        correctedLeft + elWidth / 2 - tooltipWidth / 2;
                    correctedTop = correctedTop + elHeight + gap;
            }

            setCoords({
                top: correctedTop,
                left: correctedLeft,
            });

            setShowTooltip(true);
        };

        const mouseLeave = () => {
            setShowTooltip(false);
        };

        return (
            <div onMouseEnter={mouseEnter} onMouseLeave={mouseLeave}>
                {children}
                {!IS_MOBILE && (
                    <Portal>
                        <Container
                            style={{
                                top: coords.top,
                                left: coords.left,
                                visibility: showTooltip ? "visible" : "hidden",
                            }}
                            className="tooltip"
                            ref={elRef}
                        >
                            {text}
                        </Container>
                    </Portal>
                )}
            </div>
        );
    }
);

Tooltip.defaultProps = {
    text: "",
    orientation: "right",
};

export default Tooltip;
