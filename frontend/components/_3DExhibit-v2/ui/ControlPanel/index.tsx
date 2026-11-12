import { useContext, useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import PanelProvider, { PanelContext } from "./context/PanelProvider";
import { IS_MOBILE } from "@components/_3DExhibit-v2/three/constants";
import { useWorld } from "@components/_3DExhibit-v2/hooks/useWorld";
import { amplitude_logAnalyticsEvent } from "@utils/analytics";
import { UserContext } from "@components/context/UserContext";

const DesktopPanel = dynamic(() => import("./Panel"));
const MobilePanel = dynamic(() => import("./Panel/Mobile"));
const MintProvider = dynamic(() => import("./Mint/MintProvider"));

export default function WrappedPanelControl(props) {
    const world = useWorld();

    const { user } = useContext(UserContext);

    const isMintExperience = useMemo(() => {
        return !!Object.values(props.exhibit.artworks || {}).find(
            (artwork: any) => artwork.data.mintable
        );
    }, [props.exhibit.artworks]);

    useEffect(() => {
        if (!world?.current) return;

        function handleKeys(e) {
            if (
                e.target.nodeName === "INPUT" ||
                e.target.nodeName === "TEXTAREA"
            ) {
                return;
            }

            if (e.key === "b" || e.key === "B") {
                if (props?.worldMode === "edit") return;

                if (!IS_MOBILE) {
                    document.exitPointerLock();
                }

                amplitude_logAnalyticsEvent("take_screenshot", {
                    source: "shortcut",
                    exhibitId: props.exhibit.id,
                    ownerId: props.exhibit.owner,
                    collab: props.exhibit.editors?.length > 1,
                    destination: props.exhibit.info?.room,
                    user_id: user.id,
                    exhibitName: props.exhibit.info?.headline,
                    number_of_artworks: Object.keys(
                        props.exhibit.artworks || {}
                    ).length,
                });

                const data = world.current.takeScreenshot({
                    color: null,
                    download: true,
                });

                console.log(data);
            }
        }

        window.addEventListener("keydown", handleKeys);

        return () => {
            window.removeEventListener("keydown", handleKeys);
        };
    }, [world.current, props?.worldMode]);

    const Panel = props?.isMobile ? MobilePanel : DesktopPanel;

    return (
        <PanelProvider
            exhibit={props.exhibit}
            isPlaying={props.isPlaying}
            isArtworkInfoShowing={!!props.artwork}
            artwork={props.artwork}
            setMobileViewState={props.setMobileViewState}
            enterVR={props.enterVR}
            isModeMenuOpen={props.isModeMenuOpen}
            setModeMenuOpen={props.setModeMenuOpen}
            sceneContainer={props.sceneContainer}
            settings={props.settings}
            setSettings={props.setSettings}
            destination={props.destination}
        >
            <PanelContext.Consumer>
                {({ toggleAuth }) => {
                    return isMintExperience ? (
                        <MintProvider
                            exhibit={props.exhibit}
                            isMintExperience={isMintExperience}
                            isPlaying={props.isPlaying}
                            artwork={props.artwork}
                            isArtworkInfoShowing={!!props.artwork}
                            showArtworkInfo={props.showArtworkInfo}
                            toggleAuth={toggleAuth}
                        >
                            <Panel {...props} />
                        </MintProvider>
                    ) : (
                        <Panel {...props} />
                    );
                }}
            </PanelContext.Consumer>
        </PanelProvider>
    );
}
