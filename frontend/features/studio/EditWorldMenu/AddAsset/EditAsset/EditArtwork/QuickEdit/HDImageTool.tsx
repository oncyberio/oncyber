import styled from "styled-components";

import { useSyncState } from "@components/hooks/useSyncState";
import IconImg from "@ui/components/IconImg";
import { Tool } from "@features/studio/styles/Toolbar";
import { useSelectedArtwork } from "@features/studio/EditWorldMenu/hooks/worldHooks";
import { TYPES } from "@3artwork/constants";
import { useEditWorld } from "@features/studio/EditWorldMenu/context/WorldEditContext";
import { useEventCallback } from "@components/hooks/useEventCallback";

export function ImageHDTool() {
    //
    const { handleUpdateArtworkData } = useEditWorld();

    const artwork = useSelectedArtwork();

    const [isHD, setIsHD] = useSyncState(artwork.userData.hdImage || false);

    //#region toggle on all
    /*
    useEffect(() => {
        // @ts-ignore
        window.toggleHDForArtworks = function toggleHDForArtworks() {
            const artworks = world.current.getArtworks();
            let index = 0;

            async function run() {
                if (index < artworks.length) {
                    console.log(
                        "index",
                        index + 1,
                        artworks.length,
                        artworks[index]
                    );
                } else {
                    return;
                }

                if (artworks[index]?.mediaType === TYPES.IMAGE) {
                    await handleSaveHDOption(true, artworks[index]);
                }
                // await sleep(4000);

                index++;

                await run();
            }

            run();
        };
    }, [world]);
    */
    //#endregion

    const handleSaveHDOption = useEventCallback(async () => {
        //
        const _isHD = !isHD;

        setIsHD(_isHD);

        const data = { hdImage: _isHD };

        handleUpdateArtworkData({
            data,
            analytics: {
                edited: Object.keys(data),
            },
        });
    }, []);

    const disabled = artwork.mediaType !== TYPES.IMAGE;

    return (
        <Tool
            className="tool-btn"
            disabled={disabled}
            state={isHD ? "selected" : null}
            onClick={handleSaveHDOption}
        >
            <IconImg className="tool-icon" name="hd" size={22} />
        </Tool>
    );
}
