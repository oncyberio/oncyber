import { createContext, useState, useEffect, useContext, useRef } from "react";
import { UserContext } from "@components/context/UserContext";
import { useSafeContext } from "@components/hooks/useSafeContext";
import { useSnackbar } from "@components/Snackbar";
import { useCurrentExhibit } from "@features/studio/context/ExhibitContext";
import { uploadExhibitHeroImg } from "@utils/media/mediaUploader";
import { useEventCallback } from "@components/hooks/useEventCallback";
import { amplitude_logAnalyticsEvent } from "@utils/analytics";
import { HeroImgUpdate } from "@features/studio/services/ExhibitStore";
import { useWorldState } from "@components/_3DExhibit-v2/hooks/useWorldState";
import { useWorld } from "@components/_3DExhibit-v2/hooks/useWorld";

export type CoverType = "2d" | "3d";

export interface SpaceCoverContextState {
    is2DLoading: boolean;
    is2DUploading: boolean;
    set2DUploading: (b: boolean) => void;
    is360Loading: boolean;
    generateCover: (type: CoverType, isAuto?: boolean) => Promise<void>;
    updateCover: () => Promise<void>;
}

type This = SpaceCoverContextState;

const SpaceCoverContext = createContext<This>(null);

export function SpaceCoverProvider({ children }) {
    //
    const { user, token } = useContext(UserContext);

    const { exhibit, exhibitStore } = useCurrentExhibit();

    const worldState = useWorldState();

    const [openSnackbar, closeSnackbar] = useSnackbar({
        position: "top-right",
    });

    const [is360Loading, set360Loading] = useState(false);

    const [is2DLoading, set2DLoading] = useState(false);

    const [is2DUploading, set2DUploading] = useState(false);

    const world = useWorld();

    const updateCover = useEventCallback<This["updateCover"]>(async () => {
        //
        if (exhibitStore.shouldUpdateHeroImg) {
            generateCover("3d", true);

            if (!exhibit.info?.heroImg) {
                generateCover("2d", true);
            }
        }

        //
    }, []);

    useEffect(() => {
        //
        if (!worldState.hasSpace) return;

        const lastCoverUpdate = exhibit.info.lastUpdatedHeroImg || 0;

        const lastContentUpdate = exhibit.lastContentUpdatedAt || 0;

        if (lastContentUpdate > lastCoverUpdate) {
            //
            exhibitStore.shouldUpdateHeroImg = true;

            updateCover().catch((err) => {
                //
                console.error(err);
            });
        }
        //
    }, [worldState.hasSpace]);

    const generateCover = useEventCallback<This["generateCover"]>(
        async (type: CoverType, isAuto = false) => {
            try {
                //

                const timeout = isAuto ? 5000 : 0;

                // console.log("Generating cover image", type, timeout);

                closeSnackbar();

                let heroImg = null;

                let heroImg360 = null;

                let fHeroImg = null;

                if (type === "2d" && !is2DLoading && !is2DUploading) {
                    //
                    set2DLoading(true);

                    heroImg = await world.current.takeBase64Screenshot({
                        ...exhibit.params,
                        timeout,
                    });

                    fHeroImg = await world.current.takeBase64Screenshot({
                        custom: { width: 3120, height: 1280 },
                    });
                }

                if (type === "3d" && !is360Loading) {
                    //
                    set360Loading(true);

                    heroImg360 = await world.current.takeBase64360Screenshot({
                        timeout,
                    });
                }

                const now = Date.now();

                const result = await uploadExhibitHeroImg(
                    {
                        exhibitId: exhibit.id,
                        portalId: "",
                        heroImg,
                        heroImg360,
                        fHeroImg,
                    },
                    token
                );

                if (result.success) {
                    //
                    amplitude_logAnalyticsEvent("generate_preview", {
                        user_id: user.id,
                        exhibitId: exhibit?.id,
                        ownerId: exhibit?.owner,
                        collab: exhibit?.editors?.length > 1,
                        destination: exhibit?.info?.room,
                        type,
                    });

                    let info: HeroImgUpdate = {};

                    if (result.value.url) {
                        //
                        info.cHeroImg = result.value.url;
                    }

                    if (result.value.url360) {
                        //
                        info.cHeroImg360 = result.value.url360;
                    }

                    if (result.value.furl) {
                        //
                        info.fHeroImg = result.value.furl;
                    }

                    exhibitStore.updateHeroImgs(info);
                    //
                } else {
                    throw new Error("Failed to generate cover image");
                }
            } catch (err) {
                //
                console.error(err);

                if (!isAuto) {
                    openSnackbar(
                        err?.message || "Failed to generate cover images",
                        5000,
                        null,
                        "error"
                    );
                }
            } finally {
                //
                if (type === "2d") {
                    set2DLoading(false);
                }

                if (type === "3d") {
                    set360Loading(false);
                }
            }
        },
        []
    );

    const value = {
        is2DLoading,
        is2DUploading,
        set2DUploading,
        is360Loading,
        generateCover,
        updateCover,
    };

    return (
        <SpaceCoverContext.Provider value={value}>
            {children}
        </SpaceCoverContext.Provider>
    );
}

export function useSpaceCoverContext() {
    //
    return useSafeContext(SpaceCoverContext);
}
