import React from "react";
import styled from "styled-components";
import { useSelectedArtwork } from "@features/studio/EditWorldMenu/hooks/worldHooks";
import { useSyncState } from "@components/hooks/useSyncState";
import { Field } from "@features/studio/styles/Field";
import { Label } from "@features/studio/styles/Label";
import { useEditWorld } from "@features/studio/EditWorldMenu/context/WorldEditContext";
import { useEventCallback } from "@components/hooks/useEventCallback";
import { TextAlign, TextTransform } from "@uitypes/Asset";
import IconImg from "@ui/components/IconImg";
import { LibraryTabs } from "../../../shared/Library";
import { TextSelect } from "../styles";

const textTransformOpts = [
    {
        title: "None",
        value: "none",
    },
    {
        title: "UPPER CASE",
        value: "uppercase",
    },
    {
        title: "lowercase",
        value: "lowercase",
    },
    {
        title: "Capitalize",
        value: "capitalize",
    },
    {
        title: "tOGGLE cASE",
        value: "togglecase",
    },
];

const alignOpts: TextAlign[] = ["left", "center", "right"];

export function TextStyle() {
    //
    const selectedMesh = useSelectedArtwork();

    const { handleChangeText } = useEditWorld();

    const [align, setAlign] = useSyncState(
        selectedMesh?.userData?.align || "left"
    );

    const [transform, setTransform] = useSyncState<TextTransform>(
        selectedMesh?.userData?.textTransform || "none"
    );

    const handleChangeAlign = useEventCallback(async (align: TextAlign) => {
        //
        setAlign(align);

        handleChangeText({
            update: {
                align,
            },
        });
    }, []);

    const handleChangeTextTransform = useEventCallback(
        async (textTransform: TextTransform) => {
            //
            setTransform(textTransform);

            handleChangeText({
                update: {
                    textTransform,
                },
            });
        },
        []
    );

    return (
        <Container>
            <Field>
                <Label>Alignment</Label>
                <Wrapper role="group" aria-label="Text alignment">
                    {alignOpts.map((it) => (
                        <button
                            type="button"
                            key={it}
                            aria-label={`Align ${it}`}
                            aria-pressed={it === align}
                            onClick={() => handleChangeAlign(it)}
                        >
                            <IconImg
                                name={`text-align-${it}`}
                                size={18}
                                mode="light"
                            />
                        </button>
                    ))}
                </Wrapper>
            </Field>
            <Field>
                <Label as="label" htmlFor="edit-text-case">
                    Case
                </Label>
                <TextSelect
                    id="edit-text-case"
                    value={transform}
                    onChange={(event) =>
                        handleChangeTextTransform(
                            event.target.value as TextTransform
                        )
                    }
                >
                    {textTransformOpts.map((item) => (
                        <option key={item.value} value={item.value}>
                            {item.title}
                        </option>
                    ))}
                </TextSelect>
            </Field>
        </Container>
    );
}

const Container = styled.div`
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 12px;
`;

const Wrapper = styled(LibraryTabs)`
    height: 38px;
    border: 0;
    align-items: stretch;
    & > button {
        display: grid;
        place-items: center;
        padding: 4px;
    }
    & > button:not([aria-pressed="true"]) img {
        opacity: 0.5;
    }
    @media (max-width: 600px) {
        height: 44px;
        padding: 0;
    }
`;
