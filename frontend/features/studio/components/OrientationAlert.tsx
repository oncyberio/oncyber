import React, { useEffect, useState } from "react";
import { Alert } from "@components/Dialogs/Alert";
import Modal from "@components/modals/Modal";
import { noop } from "@utils/js";

export default function OrientationAlert() {
    const [isLandscape, setIsLandscape] = useState(false);

    useEffect(() => {
        function handleOrientationChange(event) {
            setIsLandscape(event.matches);
        }

        const mediaQueryLandscape = window.matchMedia(
            "(orientation: landscape)"
        );

        if (mediaQueryLandscape.matches) {
            setIsLandscape(true);
        }

        mediaQueryLandscape.addEventListener("change", handleOrientationChange);

        return () => {
            mediaQueryLandscape.removeEventListener(
                "change",
                handleOrientationChange
            );
        };
    }, []);

    return (
        <Modal
            noShowClose={true}
            style={{
                margin: "0",
                padding: "0",
                width: "400px",
                color: "#fff",
                overflowX: "hidden",
                borderRadius: "16px",
                background: "#292929",
                zIndex: 10000000000000000,
            }}
            size="wide"
            isBackdrop
            isShowing={isLandscape}
            toggle={noop}
            isCloseRight
            iconCloseSize={"12px"}
            overlayStyle={{
                zIndex: 10000000000000000,
            }}
        >
            <Alert
                message="For the best experience, please switch to portrait mode as our platform doesn't support landscape. Thanks!"
                type="Warning"
                action={null}
            />
        </Modal>
    );
}
