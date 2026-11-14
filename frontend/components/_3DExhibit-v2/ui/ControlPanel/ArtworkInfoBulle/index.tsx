import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { ThemeProvider as StyledThemeProvider } from "styled-components";

import { ArtworkInfoProvider } from "@components/modals/ArtworkInfo/D/ArtworkContext";
import { Mode, usePanel } from "../context/PanelProvider";
import BasicArtworkInfoBulle from "./Basic";
import HelperArtworkInfoBulle from "./Helper";
import MobileArtworkInfoBulle from "./Mobile";
import SeeArtwork from "../Panel/Mobile/SeeArtwork";

const ArtworkInfoC = dynamic(() => import("@components/modals/ArtworkInfo/C"), {
    ssr: false,
});

const ArtworkInfoD = dynamic(() => import("@components/modals/ArtworkInfo/D"), {
    ssr: false,
});

interface ArtworkInfoBulleProps {
    artwork: any;
    exhibit: any;
    toggleArtworkInfo: any;
    isPlaying: boolean;
    showArtworkInfo: boolean;
    isArtInfoTransition: boolean;
    selectedMode: Mode;
}

export type AssetType = "Nft" | "Youtube" | "Unknown";

import { dark } from "@components/modals/ArtworkInfo/C/theme/dark";
import { E_INFO_BREAKPOINT } from "@components/_3DExhibit-v2/constants";
import { IS_MOBILE } from "@components/_3DExhibit-v2/three/constants";

export default function ArtworkInfoBulle(props: ArtworkInfoBulleProps) {
    let artworkInfoBulle = null;

    const {
        activeArtworkInfoBulle,
        setActiveArtworkInfoBulle,
        isMobileArtworkInfoOpened,
    } = usePanel();

    const assetType: AssetType =
        props?.artwork?.contract_address && props?.artwork?.token_id
            ? "Nft"
            : props?.artwork?.mime_type === "embed/youtube"
            ? "Youtube"
            : "Unknown";

    const isHiddenArtworkInfoBulle =
        props.artwork.mime_type === "cyber/triggerzone" ||
        props.artwork.mime_type === "cyber/globalstream";

    const [isAnimateArtworkInfoBulle, setIsAnimateArtworkInfoBulle] =
        useState(true);

    useEffect(() => {
        async function handleResize() {
            if (Mode.VIRTUAL_TOUR === props.selectedMode) {
                setActiveArtworkInfoBulle("helper");
                return;
            }

            if (IS_MOBILE || window.innerWidth < 550) {
                //
                setActiveArtworkInfoBulle("mobile");
                //
            } else if (window.innerWidth < 1100) {
                //
                setActiveArtworkInfoBulle("helper");
                //
            }
            if (window.innerWidth >= 1100) {
                //
                setActiveArtworkInfoBulle("basic");
            }
        }

        handleResize();

        window.addEventListener("resize", handleResize);
        window.addEventListener("orientationchange", handleResize);
        if (screen?.orientation) {
            screen.orientation.addEventListener("change", handleResize);
        }

        return () => {
            window.removeEventListener("resize", handleResize);
            window.removeEventListener("orientationchange", handleResize);
            if (screen?.orientation) {
                screen.orientation.removeEventListener("change", handleResize);
            }
        };
    }, [props.selectedMode]);

    /***************************************************************************
     *
     *  We need values that are consistent with the ones in DisplayScene when we
     *  play highlight transition. Also bulles must be decoupled from artwork info
     *  we use for more details.
     *
     *  Bulles are used depending on the width of the screen
     *  Highlight transition is only played on `D` area. We need to ensure that mode
     *  doesn't depend on screen orientation

        -----------------550----------------760-----------------1100------------

                Mobile          helper/C          helper/C            basic/C

        550---------------------------------------------------------------------


                Mobile         helper/C           helper/C            basic/C

        600---------------------------------------------------------------------


                Mobile        helper/C            helper/D            basic/D

    ****************************************************************************/

    if (activeArtworkInfoBulle === "helper") {
        artworkInfoBulle = <HelperArtworkInfoBulle {...props} />;
    } else if (
        activeArtworkInfoBulle === "mobile" &&
        !isMobileArtworkInfoOpened
    ) {
        // Small screens: looking at an artwork shows only its title and
        // creator. The full details cover the controls, so they open only
        // when that bubble is tapped.
        artworkInfoBulle = (
            <SeeArtwork artwork={props.artwork} assetType={assetType} />
        );
    } else if (activeArtworkInfoBulle === "mobile") {
        artworkInfoBulle = (
            <StyledThemeProvider
                theme={{
                    ...dark,
                }}
            >
                <ArtworkInfoProvider
                    toggle={props.toggleArtworkInfo}
                    isShowing={props.showArtworkInfo}
                    canStartFetch={true}
                    isAnimateArtworkInfoBulle={isAnimateArtworkInfoBulle}
                    setIsAnimateArtworkInfoBulle={setIsAnimateArtworkInfoBulle}
                    {...props}
                >
                    <MobileArtworkInfoBulle
                        artwork={props.artwork}
                        exhibit={props.exhibit}
                        toggleArtworkInfo={props.toggleArtworkInfo}
                        // isAnimateArtworkInfoBulle={isAnimateArtworkInfoBulle}
                        // {...props}
                    />
                </ArtworkInfoProvider>
            </StyledThemeProvider>
        );
    } else if (activeArtworkInfoBulle === "basic") {
        artworkInfoBulle = <BasicArtworkInfoBulle {...props} />;
    }

    const showNonMobileArtInfo =
        assetType === "Nft" &&
        props.artwork &&
        props.showArtworkInfo &&
        activeArtworkInfoBulle !== "mobile";

    let ArtworkInfoType = !showNonMobileArtInfo
        ? null
        : window.innerWidth >= E_INFO_BREAKPOINT.width &&
          window.innerHeight >= E_INFO_BREAKPOINT.height &&
          !props.artwork.mintable
        ? ArtworkInfoD
        : ArtworkInfoC;

    const artowrkInfo = ArtworkInfoType ? (
        <ArtworkInfoType
            exhibit={props.exhibit}
            toggle={props.toggleArtworkInfo}
            isShowing={props.showArtworkInfo}
            isTransition={props.isArtInfoTransition}
            artwork={props.artwork}
            type={"3d"}
            canStartFetch={true}
            isAnimateArtworkInfoBulle={isAnimateArtworkInfoBulle}
            setIsAnimateArtworkInfoBulle={setIsAnimateArtworkInfoBulle}
        />
    ) : null;

    return (
        <div>
            {artowrkInfo}
            {artowrkInfo != null || !props.isPlaying || isHiddenArtworkInfoBulle
                ? null
                : artworkInfoBulle}
        </div>
    );
}
