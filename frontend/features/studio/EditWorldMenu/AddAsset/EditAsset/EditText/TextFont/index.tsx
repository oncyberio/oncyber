import React from "react";
import { useEditWorld } from "@features/studio/EditWorldMenu/context/WorldEditContext";
import { useSelectedArtwork } from "@features/studio/EditWorldMenu/hooks/worldHooks";
import { Field } from "@features/studio/styles/Field";
import { Label } from "@features/studio/styles/Label";
import { TextSelect } from "../styles";

const items = [
    {
        title: "Aeonik Bold",
        value: "aeonik-bold",
        disabled: false,
    },
    {
        title: "Aeonik Medium",
        value: "aeonik-medium",
        disabled: false,
    },
    {
        title: "Playfair Regular",
        value: "playfair-regular",
        disabled: false,
    },
    {
        title: "Playfair Italic",
        value: "playfair-italic",
        disabled: false,
    },
];

export function TextFont() {
    //
    const selectedMesh = useSelectedArtwork();

    const { handleChangeText } = useEditWorld();

    const handleChangeFont = async (font) => {
        //
        handleChangeText({
            update: {
                font,
            },
        });
    };

    return (
        <Field>
            <Label as="label" htmlFor="edit-text-font">
                Font
            </Label>
            <TextSelect
                id="edit-text-font"
                value={selectedMesh?.userData?.font || "aeonik-bold"}
                onChange={(event) => handleChangeFont(event.target.value)}
            >
                {items.map((item) => (
                    <option
                        key={item.value}
                        value={item.value}
                        disabled={item.disabled}
                    >
                        {item.title}
                    </option>
                ))}
            </TextSelect>
        </Field>
    );
}
