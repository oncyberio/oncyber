import { Coordinates } from "@components/Form";
import { ChangeEvent, useState } from "react";
import { Buttons, CoordsWrapper, NavButton, Separator } from "./styles";
import Move from "@ui/icons/Move";
import Refresh from "@ui/icons/Refresh";
import Input from "@ui/components/Input";
import { XYZ } from "@utils/js";
import { useEventCallback } from "@components/hooks/useEventCallback";

export type Placement3DMode = "position" | "rotation";

export type Placement3DChange = { x: number } | { y: number } | { z: number };

export interface Placement3DProps {
    mode: Placement3DMode;
    position: XYZ;
    rotation: XYZ;
    onToggleMode: (mode: Placement3DMode) => unknown;
    onChange: (mode: Placement3DMode, change: Placement3DChange) => unknown;
    style?: any;
}

export function Placement3D({
    position,
    rotation,
    onToggleMode,
    onChange,
}: Placement3DProps) {
    const handleChange = useEventCallback(
        (mode: any = "position", e: ChangeEvent<HTMLInputElement>) => {
            let num;

            if (e.target.value === "") {
                num = 0;
            } else {
                num = +e.target.valueAsNumber;
            }

            if (!isNaN(num)) {
                const key = e.target.name;
                if (key === "x" || key === "y" || key === "z") {
                    // @ts-ignore
                    onChange(mode, { [key]: num });
                }
            }
        },
        []
    );

    return (
        <div
            style={{
                paddingLeft: 8,
                transform: "scale(0.92)",
                transformOrigin: "top left",
            }}
        >
            {/* <Buttons> */}
            <NavButton active={true}>
                <Move className="move" width="14px" height="14px" />
                <span>Move</span>
            </NavButton>
            {/* </Buttons> */}
            <Coordinates>
                {/* need to make the values more rounded */}
                <CoordsWrapper>
                    <p>x</p>

                    <Input
                        name="x"
                        type="number"
                        overrideTheme="light"
                        value={position.x}
                        onChange={(e) => handleChange("position", e)}
                    />
                </CoordsWrapper>
                <CoordsWrapper>
                    <p>y</p>

                    <Input
                        name="y"
                        type="number"
                        overrideTheme="light"
                        value={position.y}
                        onChange={(e) => handleChange("position", e)}
                    />
                </CoordsWrapper>
                <CoordsWrapper>
                    <p>z</p>

                    <Input
                        name="z"
                        type="number"
                        overrideTheme="light"
                        value={position.z}
                        onChange={(e) => handleChange("position", e)}
                    />
                </CoordsWrapper>
            </Coordinates>
            <NavButton active={true}>
                <Refresh className="refresh" width="14px" height="14px" />
                <span>Rotate</span>
            </NavButton>
            <Coordinates>
                {/* need to make the values more rounded */}
                <CoordsWrapper>
                    <p>x°</p>

                    <Input
                        name="x"
                        type="number"
                        overrideTheme="light"
                        value={rotation.x}
                        onChange={(e) => handleChange("rotation", e)}
                    />
                </CoordsWrapper>
                <CoordsWrapper>
                    <p>y°</p>

                    <Input
                        name="y"
                        type="number"
                        overrideTheme="light"
                        value={rotation.y}
                        onChange={(e) => handleChange("rotation", e)}
                    />
                </CoordsWrapper>
                <CoordsWrapper>
                    <p>z°</p>

                    <Input
                        style={{ padding: "0 2px" }}
                        name="z"
                        type="number"
                        overrideTheme="light"
                        value={rotation.z}
                        onChange={(e) => handleChange("rotation", e)}
                    />
                </CoordsWrapper>
            </Coordinates>
        </div>
    );
}
