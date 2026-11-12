import { useRouter } from "next/router";
import { useEffect, useRef, useState } from "react";
import styled, { css } from "styled-components";

export default function ProgressBar() {
    const router = useRouter();

    const [progress, setProgress] = useState(0);

    const timeoutRef = useRef(null);

    const currentRoute = useRef(null);

    useEffect(() => {
        function handleRouteChangeStart(route) {
            // We only show the bar when the user changes the route
            if (currentRoute.current === route.split("?")[0]) {
                return;
            }

            handleStopRouteChange();

            setProgress(0);

            handleStartRouteChange();
        }

        function handleRouteChangeComplete(route) {
            // We only show the bar when the user changes the route
            if (currentRoute.current === route.split("?")[0]) {
                return;
            }

            handleStopRouteChange();

            currentRoute.current = route.split("?")[0];
        }

        router.events.on("routeChangeStart", handleRouteChangeStart);

        router.events.on("routeChangeComplete", handleRouteChangeComplete);

        return () => {
            router.events.off("routeChangeComplete", handleRouteChangeComplete);

            router.events.off("routeChangeStart", handleRouteChangeStart);
        };
    }, []);

    function handleStartRouteChange() {
        timeoutRef.current = setTimeout(() => {
            setProgress((state) => Math.min(99, state + 1));
            handleStartRouteChange();
        }, 200);
    }

    function handleStopRouteChange() {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }

        setProgress(100);

        setTimeout(() => {
            setProgress(0);
        }, 100);
    }

    return <Container progress={progress} />;
}

const Container = styled.div<{
    progress: number;
}>`
    position: fixed;
    top: 0;
    left: 0;
    width: ${({ progress }) => progress}%;
    background: black;
    height: 4px;
    transition: 0.5s all ease;
    z-index: var(--zIndex_progress);
    border-top-right-radius: 5px;
    border-bottom-right-radius: 5px;

    ${({ progress }) => {
        return (
            progress === 0 &&
            css`
                display: none;
            `
        );
    }}
`;
