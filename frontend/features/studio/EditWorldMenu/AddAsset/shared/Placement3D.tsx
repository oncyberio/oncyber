import React, { ChangeEvent } from "react";
import styled from "styled-components";
import { XYZ } from "@utils/js";
import { useEventCallback } from "@components/hooks/useEventCallback";
import { Label } from "@features/studio/styles/Label";
import IconImg from "@ui/components/IconImg";
import { TextInput } from "@features/studio/styles/Input";

export type Placement3DMode = "position" | "rotation";

export type Placement3DChange = { x: number } | { y: number } | { z: number };

export interface Placement3DProps {
    mode: Placement3DMode;
    position: XYZ;
    rotation: XYZ;
    locked?: boolean;
    locker?: React.ReactNode;
    onToggleMode: (mode: Placement3DMode) => unknown;
    onChange: (mode: Placement3DMode, change: Placement3DChange) => unknown;
    style?: any;
    isYOnly?: boolean;
}

export function Placement3D({
    position,
    rotation,
    locked = false,
    locker = null,
    onToggleMode,
    onChange,
    isYOnly,
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
        <Container>
            <div className="row">
                <Header>
                    <IconImg name="move" mode="light" size={16} />
                    <Label>Position</Label>
                    {locker && (
                        <div style={{ marginLeft: "auto" }}>{locker}</div>
                    )}
                </Header>

                <Coordinates>
                    {/* need to make the values more rounded */}
                    <CoordsWrapper>
                        <p>x</p>

                        <TextInput
                            name="x"
                            type="number"
                            disabled={locked}
                            aria-label="Position X"
                            value={position.x}
                            onChange={(e) => handleChange("position", e)}
                        />
                    </CoordsWrapper>
                    <CoordsWrapper>
                        <p>y</p>

                        <TextInput
                            name="y"
                            type="number"
                            disabled={locked}
                            aria-label="Position Y"
                            value={position.y}
                            onChange={(e) => handleChange("position", e)}
                        />
                    </CoordsWrapper>
                    <CoordsWrapper>
                        <p>z</p>

                        <TextInput
                            name="z"
                            type="number"
                            disabled={locked}
                            aria-label="Position Z"
                            value={position.z}
                            onChange={(e) => handleChange("position", e)}
                        />
                    </CoordsWrapper>
                </Coordinates>
            </div>
            <div className="row">
                <Header>
                    <IconImg name="rotate-ccw" mode="light" size={16} />
                    <Label>Rotation</Label>
                    {/* {locker && (
                        <div style={{ marginLeft: "auto" }}>{locker}</div>
                    )} */}
                </Header>
                <Coordinates>
                    {/* need to make the values more rounded */}
                    {!isYOnly ? (
                        <CoordsWrapper>
                            <p>x°</p>

                            <TextInput
                                name="x"
                                type="number"
                                disabled={locked}
                                aria-label="Rotation X"
                                value={rotation.x}
                                onChange={(e) => handleChange("rotation", e)}
                            />
                        </CoordsWrapper>
                    ) : null}
                    <CoordsWrapper>
                        <p>y°</p>

                        <TextInput
                            name="y"
                            type="number"
                            disabled={locked}
                            aria-label="Rotation Y"
                            value={rotation.y}
                            onChange={(e) => handleChange("rotation", e)}
                        />
                    </CoordsWrapper>
                    {!isYOnly ? (
                        <CoordsWrapper>
                            <p>z°</p>

                            <TextInput
                                name="z"
                                type="number"
                                disabled={locked}
                                aria-label="Rotation Z"
                                value={rotation.z}
                                onChange={(e) => handleChange("rotation", e)}
                            />
                        </CoordsWrapper>
                    ) : null}
                </Coordinates>
            </div>
        </Container>
    );
}

const Container = styled.div`
    display: flex;
    flex-direction: column;
    gap: 16px;
`;

const CoordsWrapper = styled.div`
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 4px;
    min-width: 0;

    & > p {
        font-weight: 500;
        font-size: 14px;
        line-height: 24px;
        color: #777980;
    }

    & > input {
        min-width: 0;
        color: #ffffff;
    }
`;

const Coordinates = styled.div`
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    grid-gap: 12px;
`;

const Header = styled.div`
    display: flex;
    align-items: center;
    gap: 4px;
    font-weight: 500;
    font-size: 13px;
    line-height: 24px;
`;
