import React from "react";
import { IconButton } from "@ui/components/IconButton";
import { useWorld } from "@components/_3DExhibit-v2/hooks/useWorld";

export default function Jump({ className = "" }) {
    const world = useWorld();

    const mounseUp = (e) => {
        world.current.setJump(false);
    };

    const mounseDown = () => {
        world.current.setJump(true);
    };

    return (
        <IconButton
            mode="dark"
            name="run"
            variants="studio"
            size="large"
            className={className}
            onPointerUp={mounseUp}
            onPointerDown={mounseDown}
            onPointerLeave={mounseUp}
        />
    );
}
