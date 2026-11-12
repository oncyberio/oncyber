import { useEffect, useRef, useState } from "react";
import styled, { css } from "styled-components";
import EntryBtn from "./EntryBtn";
import Navigation from "./Navigation";
import { useHotkey } from "@components/hooks/useHotkey";

import dynamic from "next/dynamic";

const HelpModal = dynamic(() => import("../../Help"));

import useModal from "@components/modals/useModal";
import useAnalytics from "../shared/useAnalytics";
import { useMultiplayer } from "@components/_3DExhibit-v2/context/MultiplayerProvider";
import { useRouter } from "next/router";
import InfoTips from "./InfoSection/InfoTips";
import { getUser } from "@utils/saveToDb";

function eventFire(el, etype) {
    if (el.fireEvent) {
        el.fireEvent("on" + etype);
    } else {
        var evObj = document.createEvent("Events");
        evObj.initEvent(etype, true, false);
        el.dispatchEvent(evObj);
    }
}

const WASD_ARROW_KEYS = [
    "w",
    "a",
    "s",
    "d",
    "ArrowUp",
    "ArrowDown",
    "ArrowLeft",
    "ArrowRight",
];

export default function D_Menu({
    exhibit,
    destination,
    enterVR,
    play,
    hasBackPortal,
    isPlaying,
    worldState,
    isDisablePlay,
    isMobile,
    parentPage = null,
    settings,
    isInfoSectionVisible,
    toggleInfoSection,
    artwork,
}) {
    //
    const router = useRouter();

    const containerRef = useRef(null);

    const [tipsInfoClickIndex, setInfoTipsClickIndex] = useState(0);

    const [entryBtn, setEntryBtn] = useState(false);

    const [isTipsShowing, toggleTips] = useState(true);

    const [keys, setKeys] = useState({
        wasdArrow: false,
        Space: false,
        Shift: false,
        Dance: false,
    });

    const [owner, setOwner] = useState<any>({});
    const [collaborators, setCollaborators] = useState(exhibit?.editors || []);

    const isLoaded =
        worldState.type === "SPACE_IDLE" || worldState.type === "SPACE_PLAYING";

    useEffect(() => {
        async function getUserInof() {
            const data = await getUser(
                exhibit?.owner || destination?.author?.id
            );

            if (data.success) {
                setOwner(data);
            }
        }

        getUserInof();
    }, [exhibit, destination]);

    useHotkey((e) => {
        //

        if (e.key === " " && !keys?.Space) {
            setKeys((prevState) => ({
                ...prevState,
                Space: true,
            }));
        }

        if (e.key === "Shift" && !keys?.Shift) {
            setKeys((prevState) => ({
                ...prevState,
                Shift: true,
            }));
        }

        if ((e.key === "2" || e.key === "3" || e.key === "4") && !keys?.Dance) {
            setKeys((prevState) => ({
                ...prevState,
                Dance: true,
            }));
        }

        if (WASD_ARROW_KEYS.includes(e.key)) {
            setKeys((prevState) => ({
                ...prevState,
                wasdArrow: true,
            }));
        }
    });

    /*
    useEffect(() => {
        async function getCollaborators() {
            const editors = await Promise.all(
                exhibit?.editors?.map((walletId) => getUser(walletId))
            );
            setCollaborators(editors);
        }

        getCollaborators();
    }, [exhibit?.editors]);
    */

    const { isShowing, toggle } = useModal();

    const { mode } = useMultiplayer();

    const { handleStartExhibitAnalytics, handleEndExhibitAnalytics } =
        useAnalytics({
            exhibit,
            hasBackPortal,
            settings,
            destination,
        });

    useEffect(() => {
        if (keys?.wasdArrow) {
            setInfoTipsClickIndex(-1);
        }
    }, [keys]);

    useEffect(() => {
        try {
            const hasInfoTips = JSON.parse(localStorage.getItem("hasInfoTips"));
            if (hasInfoTips) {
                setInfoTipsClickIndex(-1);
            }
        } catch (err) {
            console.log(err);
        }
    }, []);

    useEffect(() => {
        const allAttributesTrue = Object.values(keys).every(
            (value) => value === true
        );

        if (allAttributesTrue) {
            setInfoTipsClickIndex(-1);
            localStorage.setItem("hasInfoTips", JSON.stringify(true));
        }
    }, [keys]);

    const playSpace = (isEnterVR = false, force = false, shouldPlay = true) => {
        if (shouldPlay) {
            if (isEnterVR) {
                enterVR();
            } else {
                handleStartExhibitAnalytics(mode);

                handleEndExhibitAnalytics(force, mode);

                play();

                if (tipsInfoClickIndex !== -1) {
                    setInfoTipsClickIndex(1);
                }
            }
        }

        try {
            const sound = document.querySelector("#app svg");

            if (sound) {
                eventFire(sound, "click");
            } else {
                console.log("PLAYING");
            }
        } catch (e) {
            console.error(e);
        }
    };

    const isPreviewEmbed = router.query.embedp != null;

    return (
        <>
            {isLoaded &&
                !isPreviewEmbed &&
                (!isPlaying || (tipsInfoClickIndex == 1 && !artwork)) && (
                    <InfoTips
                        keys={keys}
                        isPlaying={isPlaying}
                        toggleTips={toggleTips}
                        isTipsShowing={isTipsShowing}
                    />
                )}

            {!isPlaying && (
                <Container isMobile={isMobile} id="d-menu">
                    {isShowing ? (
                        <HelpModal isShowing={isShowing} toggle={toggle} />
                    ) : null}

                    {!isPreviewEmbed && (
                        <Navigation
                            exhibit={exhibit}
                            isHidden={parentPage === "mint"}
                        />
                    )}

                    <EntryContainer ref={containerRef}>
                        <EntryBtn
                            isMobile={isMobile}
                            exhibit={exhibit}
                            playSpace={playSpace}
                            worldState={worldState}
                            containerRef={containerRef}
                            isDisablePlay={isDisablePlay}
                            entryBtn={entryBtn}
                            setEntryBtn={setEntryBtn}
                        />
                    </EntryContainer>
                </Container>
            )}
        </>
    );
}

const Container = styled.div<{
    isMobile: boolean;
}>`
    width: 100%;
    height: 100%;
    overflow: hidden;
    position: absolute;
    height: var(--100-vh);

    display: flex;
    flex-direction: column;

    cursor: url("/icons/cursor.svg"), auto;

    background: linear-gradient(
        180deg,
        rgba(0, 0, 0, 0.8) 0%,
        rgba(0, 0, 0, 0.24) 45.31%,
        rgba(255, 255, 255, 0) 100%
    );

    top: 0;

    ${({ isMobile }) =>
        isMobile &&
        css`
            height: -moz-available; /* WebKit-based browsers will ignore this. */
            height: -webkit-fill-available; /* Mozilla-based browsers will ignore this. */
            height: fill-available;
        `}
`;

const EntryContainer = styled.div`
    // height: calc(var(--100-vh) - 80px - 155px);
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1;

    position: relative;
`;
