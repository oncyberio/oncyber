import { useState, useEffect } from "react";
import { useEventCallback } from "@components/hooks/useEventCallback";
import { useSyncState } from "@components/hooks/useSyncState";
import { AUDIO_TYPES, EDITION_ACTIONS } from "@3constants";
import { TYPES } from "@3factory/artwork/constants";
import { CustomDropdown } from "@features/studio/components/CustomDropdown";
import { useEditWorld } from "@features/studio/EditWorldMenu/context/WorldEditContext";
import { useSelectedArtwork } from "@features/studio/EditWorldMenu/hooks/worldHooks";
import { DropdownHeader, DropdownItem } from "@features/studio/styles/Dropdown";
import { OptionItem } from "@features/studio/types";
import { AudioType } from "@gltypes";
import Events from "@3events";
import IconImg from "@ui/components/IconImg";
import { Tool } from "@features/studio/styles/Toolbar";
import RadioBox from "@features/studio/styles/RadioBox";
import { DropdownContainer } from "./DropdownContainer";
import { Field } from "@features/studio/styles/Field";
import { Label } from "@features/studio/styles/Label";
import Slider from "@features/studio/styles/Slider";
import { useDebouncedCallback } from "@components/hooks/useDebouncedCallback";
import { useWorld } from "@components/_3DExhibit-v2/hooks/useWorld";
import { tool } from "./utils";
import { useObservableState } from "@components/_3DExhibit-v2/hooks/useObservableState";

type AudioOption = OptionItem<AudioType>;

const lookatOption: AudioOption = {
    title: "When user is looking at the asset",
    value: "lookat",
} as const;

const backgroundAudioTypeOptions: Array<AudioOption> = [
    {
        title: "Within sound radius (decays with distance)",
        value: "spatial",
    },
    {
        title: "Everywhere (constant volume)",
        value: "constant",
    },
];

const allAudioTypeOptions = [lookatOption, ...backgroundAudioTypeOptions];

export function AudioOptsTool() {
    //

    const mesh = useSelectedArtwork();

    const world = useWorld();

    const isDisabled = useObservableState(
        () => mesh.audioController == null,
        mesh,
        Events.MEDIA_PLAYER_READY
    );

    const isVideo =
        mesh.mediaType === TYPES.VIDEO ||
        mesh.mediaType === TYPES.YOUTUBE_EMBED; //!TODO-EDIT

    const { handleChangeAudio } = useEditWorld();

    const [volume, setVolume] = useSyncState(mesh?.userData?.volume || 1);

    const defaultAudioType = isVideo ? AUDIO_TYPES.LOOKAT : AUDIO_TYPES.SPATIAL;

    const [audioType, setAudioType] = useSyncState<AudioType>(
        mesh?.userData?.audioType || defaultAudioType
    );

    const handleSave = (data: Parameters<typeof handleChangeAudio>[0]) => {
        //
        handleChangeAudio(data);
    };

    const handleChangeAudioType = useEventCallback((audioType: AudioType) => {
        //
        setAudioType(audioType);

        handleSave({
            volume,
            audioType,
            analytics: { edited: ["audioType"] },
        });
    }, []);

    const handleChangeVolume = useEventCallback(
        async (volume: number, isDragging: boolean) => {
            //
            setVolume(volume);

            if (isDragging) {
                //
                await world.current.edit({
                    type: EDITION_ACTIONS.EDITOR_CHANGE_AUDIO,
                    artworkId: mesh.userData.id,
                    audioType,
                    volume,
                });
            } else {
                handleSave({
                    volume,
                    audioType,
                    analytics: { edited: ["volume"] },
                });
            }
        },
        []
    );

    if (isDisabled) {
        return tool("audio-edit", true);
    }

    const options = isVideo ? allAudioTypeOptions : backgroundAudioTypeOptions;

    return (
        <CustomDropdown
            caption={(props) => tool("audio-edit", false, props.toggled)}
        >
            {({ toggle }) => {
                return (
                    <DropdownContainer>
                        <DropdownHeader>Play Audio Options</DropdownHeader>

                        {options.map((opt) => {
                            const isSelected = opt.value === audioType;
                            return (
                                <DropdownItem
                                    isSelected={isSelected}
                                    onClick={() => {
                                        handleChangeAudioType(opt.value);
                                        if (opt.value != "spatial") {
                                            toggle(false);
                                        }
                                    }}
                                >
                                    <div className="title">{opt.title}</div>
                                    <div className="radio">
                                        <RadioBox
                                            hideLabel={true}
                                            item={opt as any}
                                            selected={isSelected}
                                        />
                                    </div>
                                </DropdownItem>
                            );
                        })}
                        {audioType === "spatial" && (
                            <div
                                style={{
                                    marginTop: "6px",
                                    paddingTop: "12px",
                                    borderTop: "1px solid #292929",
                                }}
                            >
                                <Field>
                                    <Label>
                                        Slide to increase sound distance
                                    </Label>
                                    <Slider
                                        min={1}
                                        max={40}
                                        value={volume}
                                        onChange={handleChangeVolume}
                                        mode="dark"
                                        hideInput={true}
                                    />
                                </Field>
                            </div>
                        )}
                    </DropdownContainer>
                );
            }}
        </CustomDropdown>
    );
}
