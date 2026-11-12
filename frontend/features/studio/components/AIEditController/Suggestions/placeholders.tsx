import { AssetPreview } from "@components/_3DExhibit-v2/ui/AssetsMenu/shared/ArtworkPreview";

import EnterBg from "@ui/components/Icons/EnterBg";

import styled from "styled-components";

export function getPlaceholdersSuggestions({
    onSelect,
    targetMeshes,
    opts,
    prevContext,
}) {
    const { dispatch } = opts;

    return {
        title: "Placeholders",
        suggestions: targetMeshes.map((mesh) => {
            return {
                Component: () => {
                    return <PlaceholderSuggestion mesh={mesh} />;
                },
                onselect: async () => {
                    if (!mesh) {
                        return {
                            success: false,
                            message: "Failed to execute command",
                        };
                    }

                    try {
                        return await onSelect({ mesh, opts });
                    } catch (err) {
                        return {
                            success: false,
                            message: err.message || "Failed to execute command",
                        };
                    }
                },
                onfocus: () => {
                    // teleport(mesh);

                    // make emissive
                    mesh.showSelected(true);

                    // world.current.teleport(mesh.userData.id);
                },
                onblur: () => {
                    mesh.showSelected(false);
                },
            };
        }),
    };
}

export function PlaceholderSuggestion({ mesh }) {
    return (
        <PlaceholderContainer>
            <img src={`/images/textures/placeholder.png`} alt="placeholder" />
            <div>{mesh.userData.id}</div>
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
        width: 50px;
        height: 50px;
        object-fit: cover;
    }
`;
