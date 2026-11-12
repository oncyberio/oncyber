import styled from "styled-components";
import InlineError from "@ui/components/InlineError";
import { useSpaceSwitch } from "../context/SpaceSwitchContext";
import { spaceSwitchBackTarget } from "../context/spaceSwitchMachine";
import { studioAction, studioPanel } from "../styles/primitives";

/**
 * What a visitor sees when the space they picked does not open: the intro
 * stays up, with the failure, Retry and a way back to the space they left.
 *
 * It is centred over the scene because that is where they are looking, and
 * all there is to look at: the toolbar that started the switch is unmounted
 * until a space is open again. See docs/feedback.md.
 */
export function SpaceSwitchNotice() {
    //
    const { state, retry, goBack } = useSpaceSwitch();

    // Nothing while a switch or a retry runs: the intro is the progress, and
    // an old failure should not sit beside it.
    if (state.status !== "failed") return null;

    const back = spaceSwitchBackTarget(state);

    return (
        <Frame>
            <Panel>
                <InlineError
                    message="Couldn't open this space."
                    onRetry={() => void retry()}
                />
                {back && (
                    <BackButton type="button" onClick={() => void goBack()}>
                        Back to the previous space
                    </BackButton>
                )}
            </Panel>
        </Frame>
    );
}

// The same box as StudioSceneFrame, so the notice is centred on the intro.
const Frame = styled.div`
    position: fixed;
    top: 64px;
    left: 6px;
    right: 6px;
    bottom: 6px;
    z-index: 1;
    display: grid;
    place-items: center;
    padding: 16px;
    pointer-events: none;

    @media (max-width: 600px) {
        left: 0;
        right: 0;
        bottom: 0;
    }
`;

const Panel = styled.div`
    ${studioPanel}
    display: grid;
    gap: var(--studio-grid-gap, 8px);
    width: min(100%, 360px);
    padding: var(--studio-panel-padding, 14px);
    pointer-events: auto;
`;

const BackButton = styled.button`
    ${studioAction}
    width: 100%;
    color: var(--studio-secondary, #c6c6c6);
`;
