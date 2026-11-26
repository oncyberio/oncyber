import { useEffect, useRef, type RefObject } from "react";
import {
    buildSocialHandoff,
    SOCIAL_HANDOFF,
    SOCIAL_REQUEST,
    type SocialHandoff,
} from "./gameSocial";

type LobbySocial = {
    sessionId: string;
    messages: ReadonlyArray<object>;
    voiceState: string;
    lobbyPresent: boolean;
};

/**
 * The lobby's voice as the visitor left it. The lobby turns its own voice
 * off once the visitor is in a world, so the state is remembered from the
 * last moment they were still present.
 */
export function departureVoice(
    remembered: string,
    social: Pick<LobbySocial, "voiceState" | "lobbyPresent">
) {
    return social.lobbyPresent ? social.voiceState : remembered;
}

/**
 * The lobby's half of chat and voice continuity into games
 * (docs/games/voice-chat.md). A game page in the destination frame asks for
 * the visitor's lobby chat and voice state; only that frame, on this origin,
 * is answered.
 */
export function useLobbySocialHandoff(
    frame: RefObject<HTMLIFrameElement>,
    social: LobbySocial
) {
    const voice = useRef("off");
    voice.current = departureVoice(voice.current, social);
    const handoff = useRef<SocialHandoff>();
    handoff.current = buildSocialHandoff(
        social.messages || [],
        social.sessionId || "",
        voice.current
    );
    useEffect(() => {
        const answer = (event: MessageEvent) => {
            const target = frame.current?.contentWindow;
            if (
                !target ||
                event.source !== target ||
                event.origin !== window.location.origin ||
                event.data?.type !== SOCIAL_REQUEST
            )
                return;
            target.postMessage(
                { type: SOCIAL_HANDOFF, ...handoff.current },
                window.location.origin
            );
        };
        window.addEventListener("message", answer);
        return () => window.removeEventListener("message", answer);
    }, [frame]);
}
