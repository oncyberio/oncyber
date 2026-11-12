import { useEffect, useRef } from "react";
import styled from "styled-components";
import { useLandingActivity } from "../activity";
import { scrollLogoPose } from "./cyberloopMorph";

const ARRIVAL = scrollLogoPose(0);

export default function ScrollLinkedCyberloopMark() {
    const activity = useLandingActivity();
    const element = useRef<SVGSVGElement>(null);
    const turn = useRef<SVGGElement>(null);
    const paths = useRef<SVGPathElement[]>([]);

    useEffect(() => {
        const mark = element.current;
        if (!mark) return;
        const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
        function sync() {
            if (document.hidden) return;
            const progress = activity?.getScrollProgress() || 0;
            const pose = scrollLogoPose(progress, motion.matches);
            pose.paths.forEach((d, index) => {
                const path = paths.current[index];
                if (path && path.getAttribute("d") !== d)
                    path.setAttribute("d", d);
            });
            turn.current?.setAttribute("transform", `rotate(${pose.angle})`);
            mark.dataset.cyberloopForm = pose.form;
            mark.dataset.cyberloopProgress = pose.progress.toFixed(3);
            mark.dataset.cyberloopState =
                motion.matches || progress <= 0 ? "idle" : "scroll-linked";
        }
        const unsubscribe = activity?.subscribeScroll(sync);
        motion.addEventListener("change", sync);
        document.addEventListener("visibilitychange", sync);
        sync();
        return () => {
            unsubscribe?.();
            motion.removeEventListener("change", sync);
            document.removeEventListener("visibilitychange", sync);
        };
    }, [activity]);

    return (
        <Mark
            ref={element}
            className="cyberloop-mark"
            viewBox="-180 -180 360 360"
            aria-hidden="true"
            focusable="false"
            data-cyberloop-state="idle"
            data-cyberloop-form="original"
            data-cyberloop-progress="0.000"
        >
            <g ref={turn} transform={`rotate(${ARRIVAL.angle})`}>
                {ARRIVAL.paths.map((d, index) => (
                    <path
                        key={index}
                        ref={(node) => {
                            paths.current[index] = node;
                        }}
                        fill="currentColor"
                        d={d}
                    />
                ))}
            </g>
        </Mark>
    );
}

const Mark = styled.svg`
    display: block;
    flex-shrink: 0;
    width: 34px;
    height: 34px;
    color: #fff;
    @media (max-width: 700px) {
        width: 30px;
        height: 30px;
    }
`;
