import { useEffect, useRef } from "react";

import styled from "styled-components";

import nipplejs from "nipplejs";
import { useWorld } from "@components/_3DExhibit-v2/hooks/useWorld";

export default function Joystick() {
    const nipple = useRef(null);

    const world = useWorld();

    const mobileMoveRef = useRef(null);

    useEffect(() => {
        if (mobileMoveRef.current && !nipple.current) {
            nipple.current = nipplejs.create({
                zone: mobileMoveRef.current,
                color: "#070707",
                mode: "static",
                dynamicPage: true,
                restOpacity: 0.8,
                threshold: 0.7,
                size: 80,
                shape: "circle",
                position: {
                    bottom: "50%",
                    left: "50%",
                },
            });

            nipple.current.on(
                // @ts-ignore
                "start end dir:up dir:left dir:down dir:right",
                (event, data) => {
                    if (data.force < 0.6) return;

                    let code = "";

                    if (event.type === "dir:up") {
                        code = "KeyW";
                    } else if (event.type === "dir:down") {
                        code = "KeyS";
                    } else if (event.type === "dir:left") {
                        code = "KeyA";
                    } else if (event.type === "dir:right") {
                        code = "KeyD";
                    }

                    world.current.mobileMove({
                        code,
                        event: event.type,
                        source: "joystick",
                    });
                }
            );
        }

        return () => {
            if (nipple.current) {
                nipple.current.destroy();
                nipple.current = null;
                // joystickMovingRef.current = false;
            }
        };
    }, [mobileMoveRef.current]);

    return (
        <Container>
            <div ref={mobileMoveRef} />
        </Container>
    );
}

const Container = styled.div`
    position: fixed;
    // z-index: 1000;
    height: 100px;
    width: 120px;
    bottom: 80px;
`;
