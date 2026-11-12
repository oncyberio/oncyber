import {
    UtilityStack,
    UtilityActions,
    UtilityButton,
} from "@features/content-host/NativeVisitorPanel";
import { useCyberTranslation } from "@components/context/I18nContext";
import { useEventCallback } from "@components/hooks/useEventCallback";
import { useMultiplayer } from "@components/_3DExhibit-v2/context/MultiplayerProvider";
import { IS_CHROME } from "@components/_3DExhibit-v2/three/constants";

import styled from "styled-components";
import { usePanel } from "../context/PanelProvider";
import { useMediaPlaceholders } from "../shared/useMediaPlaceholders";

export default function ShareMedia({}) {
    const { setCurrentTab } = usePanel();

    const { voice } = useMultiplayer();

    const { t } = useCyberTranslation();

    const { voiceState, togglePlaying } = voice;

    const { nbAvailable } = useMediaPlaceholders();

    const handleStartMediaSharing = useEventCallback((audioOnly: boolean) => {
        //
        if (voiceState.type === "disabled" || voiceState.state.isPlaying) {
            //
            console.error("handleStartAudioSharing/Invalid state", voiceState);

            return;
        }

        if (audioOnly) {
            setCurrentTab("");
            togglePlaying(true, { audioOnly });
        } else {
            //
            if (nbAvailable > 1) {
                //
                setCurrentTab("select-media-placeholder");
                //
            } else {
                //
                togglePlaying(true, { audioOnly: false });

                setCurrentTab("");
            }
        }
    }, []);

    return (
        <Container>
            <p>
                {t`AUDIO_SHARE_DESCRIPTION_P1`}. <br />{" "}
                {IS_CHROME
                    ? t`AUDIO_SHARE_CHROME_DESCRIPTION_P2`
                    : t`AUDIO_SHARE_MICROSOFT_EDGE_TAB_DESCRIPTION_P2`}
            </p>

            <UtilityActions>
                <UtilityButton onClick={() => handleStartMediaSharing(true)}>
                    {t`SHARE_AUDIO`}
                </UtilityButton>

                <UtilityButton
                    $primary
                    onClick={() => handleStartMediaSharing(false)}
                >
                    {t`SCREEN_AUDIO`}
                </UtilityButton>
            </UtilityActions>
        </Container>
    );
}

const Container = styled(UtilityStack)`
    > p {
        font-size: 13px;
        line-height: 1.6;
    }
`;
