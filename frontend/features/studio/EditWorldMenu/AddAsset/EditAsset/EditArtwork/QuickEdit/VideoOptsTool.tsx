import { useEventCallback } from "@components/hooks/useEventCallback";
import { useSyncState } from "@components/hooks/useSyncState";
import { CustomDropdown } from "@features/studio/components/CustomDropdown";
import { useEditWorld } from "@features/studio/EditWorldMenu/context/WorldEditContext";
import { useSelectedArtwork } from "@features/studio/EditWorldMenu/hooks/worldHooks";
import { DropdownHeader, DropdownItem } from "@features/studio/styles/Dropdown";
import { OptionItem } from "@features/studio/types";
import { VideoPlaybackType } from "@gltypes";
import Events from "@3events";
import IconImg from "@ui/components/IconImg";
import { Tool } from "@features/studio/styles/Toolbar";
import RadioBox from "@features/studio/styles/RadioBox";
import { DropdownContainer } from "./DropdownContainer";
import { tool } from "./utils";
import { useObservableState } from "@components/_3DExhibit-v2/hooks/useObservableState";

type VideoOption = OptionItem<VideoPlaybackType>;

const videoOpts: Array<VideoOption> = [
    {
        title: "Click to start",
        value: "manual",
    },
    {
        title: "Autoplay",
        value: "auto",
    },
];

export function VideoOptsTool() {
    //

    const mesh = useSelectedArtwork();

    const isDisabled = useObservableState(
        () => mesh.videoController == null,
        mesh,
        Events.MEDIA_PLAYER_READY
    );

    const { handleChangeVideo } = useEditWorld();

    const [videoPlayback, setVideoPlayback] = useSyncState<VideoPlaybackType>(
        mesh.userData.videoPlayback || "auto"
    );

    const handleChangePlayback = useEventCallback(
        (videoPlayback: VideoPlaybackType) => {
            //
            setVideoPlayback(videoPlayback);
            handleChangeVideo({ videoPlayback });
        },
        []
    );

    if (isDisabled) {
        return tool("playback-edit", true);
    }

    return (
        <CustomDropdown
            caption={(props) => tool("playback-edit", false, props.toggled)}
        >
            {({ toggle }) => {
                return (
                    <DropdownContainer>
                        <DropdownHeader>Video Playback Options</DropdownHeader>

                        {videoOpts.map((opt) => {
                            const isSelected = opt.value === videoPlayback;
                            return (
                                <DropdownItem
                                    style={{ width: 250 }}
                                    isSelected={isSelected}
                                    onClick={() => {
                                        toggle(false);
                                        handleChangePlayback(opt.value);
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
                    </DropdownContainer>
                );
            }}
        </CustomDropdown>
    );
}
