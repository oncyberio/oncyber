// @ts-check

import React, { useContext, useEffect, useMemo, useRef, useState } from "react";

import { UserContext } from "@components/context/UserContext";

import { isLandscape as _isLandscape } from "@3utils/platform";

import { Scene3D } from "./Scene3D";

import { Experience } from "@uitypes/experience";

import { RoomParameters } from "@uitypes/roomParameters";

import { useWorld } from "../hooks/useWorld";

import { usePointerLock } from "./usePointerLock";

import { useWorldState } from "../hooks/useWorldState";

import { usePanoModeHandler } from "../hooks/usePanoModeHandler";

import { APP_STATES, IS_MOBILE } from "../three/constants";

import Joystick from "../ui/EditMenu/Joystick";

import Events from "@3events";

import { useWorldHandler } from "@components/_3DExhibit-v2/hooks/useWorldHandler";

interface Exhibit3DEditProps {
    exhibit: Experience;
    destination?: RoomParameters;
    renderChildren?: (state) => JSX.Element;
}

export default function Exhibit3DEdit({
    exhibit,
    destination: _destination,
    renderChildren,
}: Exhibit3DEditProps) {
    //
    const { user } = useContext(UserContext);

    const world = useWorld();

    const sceneRef = useRef(null);

    const [currentControls, setCurrentControls] = useState<
        "EditModeControls" | "MapControls"
    >(null);

    const [isSceneStarted, setIsSceneStarted] = useState(false);

    const [destination, setDestination] = useState(_destination);

    const opts = useWorldState();

    useEffect(() => {
        //
        document.body.style.overflow = "hidden";
    }, []);

    useWorldHandler(Events.TUNNEL_TRANSITION_DONE, () => {
        console.log("TUNNEL - handleTunnelTransitionEnd called");

        if (world.current) {
            console.log(
                "world.current.getCurrentControls().name === ",
                world.current.getCurrentControls()
            );
            setCurrentControls(world.current.getCurrentControls()?.name);
        }

        setIsSceneStarted(true);
    });

    useWorldHandler(Events.TUNNEL_TRANSITION_START, () => {
        console.log("TUNNEL - handleTunnelTransitionStart called");

        setIsSceneStarted(false);
    });

    useWorldHandler(Events.EDIT_MODE_CAMERA_MODE_SWITCH_DONE, () => {
        setCurrentControls(world.current.getCurrentControls()?.name);
    });

    useWorldHandler(Events.EDIT_MODE_CAMERA_MODE_SWITCH_START, () => {
        setCurrentControls(null);
    });

    usePointerLock(
        opts.mode === "display" || opts.state === APP_STATES.PANORAMA
    );

    usePanoModeHandler(opts.hasSpace && opts.mode === "display");

    function onInitSpace(destination) {
        if (_destination !== destination) {
            setDestination(destination);
        }
    }

    return (
        <Scene3D
            key={exhibit.id}
            editMode={true}
            exhibit={exhibit}
            destination={destination}
            onInitSpace={onInitSpace}
        >
            {({ sceneContainer, worldState }) => {
                return (
                    <>
                        {isSceneStarted &&
                        currentControls === "EditModeControls" &&
                        IS_MOBILE ? (
                            <Joystick />
                        ) : null}
                        {renderChildren}
                    </>
                );
            }}
        </Scene3D>
    );
}
