import { AssetPreview } from "@components/_3DExhibit-v2/ui/AssetsMenu/shared/ArtworkPreview";

import EnterBg from "@ui/components/Icons/EnterBg";

import styled from "styled-components";

export function getRoomSuggestions({
    onSelect,
    targetRooms,
    opts,
    prevContext,
}) {
    const { dispatch } = opts;

    return {
        title: "Destinations",
        suggestions: targetRooms.map((destination) => {
            return {
                Component: () => {
                    return <RoomSuggestion destination={destination} />;
                },
                onselect: async () => {
                    if (!destination) {
                        return {
                            success: false,
                            message: "Failed to execute command",
                        };
                    }

                    try {
                        return await onSelect({ destination, opts });
                    } catch (err) {
                        return {
                            success: false,
                            message: "Failed to execute command",
                        };
                    }
                },
                // onfocus: () => {
                //     // teleport(mesh);

                //     // make emissive
                //     destination.showSelected(true);

                //     // world.current.teleport(mesh.userData.id);
                // },
                // onblur: () => {
                //     destination.showSelected(false);
                // },
            };
        }),
    };
}

export function RoomSuggestion({ destination }) {
    return (
        <PlaceholderContainer>
            <img src={destination?.image || destination?.thumbnail || `/images/sq_image_placeholder.png`} alt="preview" />
            <div>{destination?.name}</div>
        </PlaceholderContainer>
    );
}

const PlaceholderContainer = styled.div`
    font-size: 13px;
    display: flex;
    gap: 12px;
    overflow: hidden;

    p {
        margin: 0;
    }

    & > img,
    video {
        width: 70px;
        height: 50px;
        object-fit: cover;
        border-radius: 4px;
    }
`;
