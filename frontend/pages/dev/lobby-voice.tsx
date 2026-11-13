import { useRef, useState } from "react";
import styled from "styled-components";
import { brandFoundation } from "@styles/brand";
import LobbyChat, { ConversationSocial } from "@features/lobby/LobbyChat";
import LobbyConversationSurface from "@features/lobby/LobbyConversationSurface";
import LobbyPeoplePanel from "@features/lobby/LobbyPeoplePanel";
import LobbyVoiceRequests from "@features/lobby/LobbyVoiceRequests";
import LobbySummonNotice from "@features/lobby/LobbySummonNotice";
import type {
    LobbyAdminAction,
    LobbyStage,
    LobbyStagePerson,
} from "@features/lobby/LobbyConnection";

const SELF = "1";
const PEOPLE = [
    {
        id: SELF,
        name: "You",
        avatar: "",
        isLocal: true,
        role: "owner" as const,
    },
    { id: "2", name: "Ada", avatar: "" },
    { id: "3", name: "Kenji", avatar: "" },
    { id: "4", name: "Mira Okafor", avatar: "" },
];
const person = (id: string): LobbyStagePerson => ({
    sessionId: id,
    name: PEOPLE.find((p) => p.id === id)!.name,
    avatar: "",
});

/** Lobby voice as the main admin sees it, with a local stand-in for the server. */
export default function LobbyVoicePreview() {
    const [stage, setStage] = useState<LobbyStage>({
        speakers: [],
        limit: 8,
        role: "owner",
        muted: false,
        requested: false,
        requests: ["2", "3", "4"].map(person),
        mutedPeople: [],
        spatial: true,
    });
    const [open, setOpen] = useState(false);
    const [people, setPeople] = useState(true);
    const [summon, setSummon] = useState(() => ({
        sessionId: "3",
        name: "Kenji",
        avatar: "",
        receivedAt: Date.now(),
    }));
    const inputRef = useRef<HTMLInputElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const onAdmin = async (action: LobbyAdminAction, id: string) => {
        setStage((s) => {
            const requests = s.requests.filter((r) => r.sessionId !== id);
            if (action === "stage-add")
                return {
                    ...s,
                    requests,
                    speakers: s.speakers.some((r) => r.sessionId === id)
                        ? s.speakers
                        : [...s.speakers, person(id)],
                };
            if (action === "stage-remove")
                return {
                    ...s,
                    speakers: s.speakers.filter((r) => r.sessionId !== id),
                };
            if (action === "decline-request") return { ...s, requests };
            return s;
        });
        return "";
    };
    const social: ConversationSocial = {
        sessionId: SELF,
        status: "connected",
        players: PEOPLE,
        messages: [],
        sendMessage: () => true,
    };
    return (
        <Preview>
            <LobbyConversationSurface>
                <LobbyChat
                    social={social}
                    open={open}
                    onOpenChange={setOpen}
                    inputRef={inputRef}
                    buttonRef={buttonRef}
                    hidden={false}
                    notices={
                        <>
                            <LobbySummonNotice
                                summon={summon}
                                onGo={() =>
                                    // The preview loops the countdown.
                                    setSummon(
                                        (value) =>
                                            value && {
                                                ...value,
                                                receivedAt: Date.now(),
                                            }
                                    )
                                }
                                onStay={() => setSummon(null)}
                            />
                            <LobbyVoiceRequests
                                stage={stage}
                                onAdmin={onAdmin}
                                onShowAll={() => setPeople(true)}
                            />
                        </>
                    }
                />
            </LobbyConversationSurface>
            {people && (
                <LobbyPeoplePanel
                    players={PEOPLE}
                    population={PEOPLE.length}
                    status="connected"
                    onClose={() => setPeople(false)}
                    onGoTo={() => {}}
                    onSummonAll={() => {}}
                    voice={{
                        stage,
                        voiceState: "off",
                        onListen: () => {},
                        onRequest: () => {},
                        onLeave: () => onAdmin("stage-remove", SELF),
                        onAdmin,
                    }}
                />
            )}
        </Preview>
    );
}

const Preview = styled.main`
    ${brandFoundation}
    position: fixed;
    inset: 0;
    background: radial-gradient(circle at 50% 30%, #3a3f48, #0b0c0f 70%);
`;

// Internal test page: not found outside development, like the other
// pages in pages/dev.
export function getServerSideProps() {
    return process.env.NODE_ENV === "development"
        ? { props: {} }
        : { notFound: true };
}
