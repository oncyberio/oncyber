import React, { useEffect, useRef, useState } from "react";

import World from "@3gl/api";
import Events from "@3events";
import {
    APP_STATES,
    CANVAS,
    CURRENT_STATE,
    IS_DEBUG_VIEW,
    IS_DESKTOP,
    IS_MOBILE,
    IS_POINTER_LOCK,
} from "@3constants";

import { isLandscape as _isLandscape } from "@3utils/platform";
import { Scene3D, Scene3DProps } from "./Scene3D";

import { WorldProvider } from "../context/WorldProvider";
import { IS_FLY } from "../three/camera/constants";
import { useEventCallback } from "@components/hooks/useEventCallback";
import { useWorld } from "../hooks/useWorld";

export function Exhibit3DUploader_Child(props) {
    //
    const world = useWorld();

    const [isPlaying, setIsPlaying] = useState(false);

    //#region event handlers
    // IMPORTANT: following callbacks to be invoked from outside React
    //            thus we can safely use useEventCallback

    const isUsingPointerLock = () => {
        return (
            CURRENT_STATE !== APP_STATES.CINEMATIC &&
            IS_DESKTOP &&
            props.guiState === "Settings" &&
            !props.uploaderParameters.isFuture
        );
    };

    const handlePointerLockChange = useEventCallback(() => {
        if (isUsingPointerLock() && !IS_POINTER_LOCK()) {
            setIsPlaying(false);
        }
    }, []);

    const handleMouseDown = useEventCallback(() => {
        console.log("clicked...");

        if (isUsingPointerLock() && isPlaying && !IS_POINTER_LOCK()) {
            return CANVAS.requestPointerLock();
        }

        if (isPlaying) return;

        if (
            isUsingPointerLock() &&
            !IS_POINTER_LOCK() &&
            !IS_FLY &&
            !IS_DEBUG_VIEW
        ) {
            play();
        }
    }, []);

    const handleKeydown = useEventCallback((e) => {
        if (isUsingPointerLock() && (e.key === "Escape" || e.key === "Enter")) {
            e.preventDefault();
            document.exitPointerLock();
            return;
        }
    }, []);

    //#endregion

    //#region effects

    useEffect(() => {
        if (!props.isDisplayed) {
            pause();
        }
    }, [props.isDisplayed]);

    useEffect(() => {
        if (CANVAS) {
            if (IS_DESKTOP) {
                CANVAS.addEventListener("mousedown", handleMouseDown);
            }

            if (IS_MOBILE) {
                CANVAS.addEventListener("touchend", handleMouseDown);
            }

            document.addEventListener(Events.KEY_DOWN, handleKeydown);

            document.addEventListener(
                Events.POINTER_LOCK,
                handlePointerLockChange
            );

            return () => {
                if (IS_MOBILE) {
                    CANVAS.removeEventListener("touchend", handleMouseDown);
                }

                if (IS_DESKTOP) {
                    CANVAS.removeEventListener("mousedown", handleMouseDown);
                }

                document.removeEventListener(
                    Events.POINTER_LOCK,
                    handlePointerLockChange
                );
                document.removeEventListener(Events.KEY_DOWN, handleKeydown);
            };
        }
    }, [
        CANVAS,
        IS_DESKTOP,
        IS_MOBILE,
        handleMouseDown,
        handleKeydown,
        handlePointerLockChange,
    ]);

    useEffect(() => {
        if (props.guiState === "Cinematic" || props.guiState === "World") {
            if (IS_POINTER_LOCK()) {
                document.exitPointerLock();
            }
            play();
        }
    }, [props.guiState]);
    //#endregion

    const play = () => {
        //
        if (!world.current || isPlaying) return;

        if (isUsingPointerLock()) {
            //
            CANVAS.requestPointerLock();
        }

        if (CURRENT_STATE === APP_STATES.IDLE) {
            //

            world.current.setState(APP_STATES.SPACE, {}).then(() => {
                //
                props.onSceneLoaded?.();
            });

            //
        } else {
            world.current.play();
        }

        setIsPlaying(true);
    };

    const pause = () => {
        if (!world.current || !isPlaying) return;

        if (IS_POINTER_LOCK()) {
            document.exitPointerLock();
        }

        world.current?.pause?.();
        setIsPlaying(false);
    };

    return (
        <Scene3D {...props} onInitSpace={play} setIsPlaying={setIsPlaying} />
    );
}

export default function Exhibit3DUploader(props: Scene3DProps) {
    const world = useRef<World>(null);

    return (
        <WorldProvider world={world}>
            <Exhibit3DUploader_Child {...props} isUploader />
        </WorldProvider>
    );
}
