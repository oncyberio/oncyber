jest.mock("@components/_3DExhibit-v2/context/MultiplayerProvider", () => ({}));
jest.mock(
    "@components/_3DExhibit-v2/ui/ControlPanel/context/PanelProvider",
    () => ({})
);
jest.mock("@utils/analytics", () => ({}));
jest.mock("@ui/components/InlineError", () => () => null);
import { voiceRequestView } from "./SpaceVoiceRequests";

test("names the visitor and says whether they ask to speak or share", () => {
    expect(
        voiceRequestView({
            reason: "mic",
            user: {
                sessionId: "s1",
                userData: { username: "amy", avatar: "a.png" },
            },
        })
    ).toEqual({
        sessionId: "s1",
        name: "amy",
        avatar: "a.png",
        sharing: false,
    });
    expect(
        voiceRequestView({
            reason: "broadcast",
            user: {
                sessionId: "s2",
                userData: { walletId: "0x1234567890abcdef" },
            },
        })
    ).toEqual({
        sessionId: "s2",
        name: "0x12…cdef",
        avatar: "",
        sharing: true,
    });
});
