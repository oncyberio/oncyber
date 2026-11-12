import React from "react";
import styled from "styled-components";
import { Color } from "three";
import { useEditWorld } from "@features/studio/EditWorldMenu/context/WorldEditContext";
import { useSelectedArtwork } from "@features/studio/EditWorldMenu/hooks/worldHooks";
import { useEventCallback } from "@components/hooks/useEventCallback";
import { Field } from "@features/studio/styles/Field";
import { Label } from "@features/studio/styles/Label";
import { studioAction } from "@features/studio/styles/primitives";

const textColors = [
    { name: "White", value: "#ffffff" },
    { name: "Red", value: "#ff0909" },
    { name: "Charcoal", value: "#1d1d1d" },
    { name: "Orange", value: "#ff730c" },
    { name: "Blue", value: "#1721ff" },
];

const threeColor = new Color();

export function TextColor() {
    const selectedMesh = useSelectedArtwork();
    const { handleChangeText } = useEditWorld();

    const handleChangeColor = useEventCallback((value: string) => {
        handleChangeText({
            update: { textColor: new Color(value).toArray() },
        });
    }, []);

    const rgb = selectedMesh?.userData?.textColor;
    const selectedColor = rgb
        ? "#" + threeColor.setRGB(rgb[0], rgb[1], rgb[2]).getHexString()
        : "#ffffff";
    const isCustom = !textColors.some((color) => color.value === selectedColor);

    return (
        <Field>
            <Label>Color</Label>
            <Colors role="group" aria-label="Text color">
                {textColors.map(({ name, value }) => (
                    <Swatch
                        key={value}
                        type="button"
                        aria-label={name}
                        aria-pressed={selectedColor === value}
                        title={name}
                        onClick={() => handleChangeColor(value)}
                    >
                        <span style={{ background: value }} />
                    </Swatch>
                ))}
                <CustomColor $selected={isCustom} title="Custom color">
                    <span className="color-wheel" />
                    <input
                        type="color"
                        aria-label="Custom text color"
                        value={selectedColor}
                        onChange={(event) =>
                            handleChangeColor(event.target.value)
                        }
                    />
                </CustomColor>
            </Colors>
        </Field>
    );
}

const Colors = styled.div`
    display: grid;
    grid-template-columns: repeat(6, minmax(0, 1fr));
    gap: 6px;
`;

const Swatch = styled.button`
    ${studioAction}
    padding: 6px;
    min-width: 0;
    height: 38px;

    & > span {
        display: block;
        width: 22px;
        height: 22px;
        border: 1px solid #ffffff26;
        border-radius: 50%;
    }

    &[aria-pressed="true"] {
        border-color: var(--studio-muted);
        background: var(--studio-hover);
    }

    @media (max-width: 600px) {
        height: 44px;
    }
`;

const CustomColor = styled.label<{ $selected: boolean }>`
    ${studioAction}
    position: relative;
    min-width: 0;
    height: 38px;
    padding: 6px;
    border-color: ${(p) =>
        p.$selected ? "var(--studio-muted)" : "transparent"};
    background: ${(p) => (p.$selected ? "var(--studio-hover)" : "transparent")};

    .color-wheel {
        width: 22px;
        height: 22px;
        border-radius: 50%;
        background: conic-gradient(
            #ff8080,
            #ffe080,
            #80db9a,
            #80b0ff,
            #c480ff,
            #ff8080
        );
    }

    input {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        opacity: 0;
        cursor: pointer;
    }

    &:focus-within {
        outline: 2px solid var(--studio-ink);
        outline-offset: 2px;
    }

    @media (max-width: 600px) {
        height: 44px;
    }
`;
