import { useRef, useState } from "react";
import { useRouter } from "next/router";
import styled from "styled-components";
import { brandFoundation } from "@styles/brand";
import LobbyChat, { ConversationSocial } from "@features/lobby/LobbyChat";
import LobbyConversationSurface from "@features/lobby/LobbyConversationSurface";
import { conversationStyles } from "@features/lobby/conversationStyles";

const SELF = "self";
const PEOPLE = [
    { id: SELF, name: "You", avatar: "", isLocal: true },
    { id: "ada", name: "Ada", avatar: "" },
    { id: "kenji", name: "Kenji", avatar: "" },
    { id: "mira", name: "Mira Okafor", avatar: "" },
    { id: "theo", name: "Theo", avatar: "" },
];
const MESSAGES = [
    ["ada", "anyone heading to the museum district?"],
    ["kenji", "yes, give me a sec"],
    [SELF, "same, meet at the portal"],
    ["mira", "the new flash drops are wild"],
    ["theo", "👋"],
].map(([sessionId, text], index) => ({
    id: `m${index}`,
    sessionId,
    name: PEOPLE.find((person) => person.id === sessionId).name,
    text,
    sentAt: index + 1,
}));

/** Isolated chat states; no lobby, room or network activity. ?host=gallery&empty&alone */
export default function LobbyChatPreview() {
    const { query, isReady } = useRouter();
    return isReady ? <ChatPreview query={query} /> : null;
}

function ChatPreview({ query }: { query: Record<string, unknown> }) {
    const [open, setOpen] = useState(true);
    const inputRef = useRef<HTMLInputElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const [messages, setMessages] = useState("empty" in query ? [] : MESSAGES);
    const social: ConversationSocial = {
        sessionId: SELF,
        status: "connected",
        players: "alone" in query ? PEOPLE.slice(0, 1) : PEOPLE,
        messages,
        sendMessage(text, recipientId) {
            setMessages((previous) => [
                ...previous,
                {
                    id: `m${previous.length}-${Date.now()}`,
                    sessionId: SELF,
                    name: "You",
                    text,
                    recipientId,
                    sentAt: Date.now(),
                },
            ]);
            return true;
        },
    };
    const chat = (
        <LobbyChat
            social={social}
            open={open}
            onOpenChange={setOpen}
            inputRef={inputRef}
            buttonRef={buttonRef}
            hidden={false}
            {...(query.host === "gallery"
                ? { roomLabel: "Room", spaceLabel: "room" }
                : {})}
        />
    );
    return (
        <Preview>
            {query.host === "gallery" ? (
                <Gallery>{chat}</Gallery>
            ) : (
                <LobbyConversationSurface>{chat}</LobbyConversationSurface>
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

const Gallery = styled.div`
    ${conversationStyles}
    position: absolute;
    left: 24px;
    bottom: 24px;
    width: 340px;
    color: #e8e9ec;
    .lobby-chat {
        max-height: 50vh;
        display: flex;
        flex-direction: column;
        justify-content: flex-end;
    }
    button {
        color: inherit;
        cursor: pointer;
        font-family: inherit;
    }
`;

// Internal test page: not found outside development, like the other
// pages in pages/dev.
export function getServerSideProps() {
    return process.env.NODE_ENV === "development"
        ? { props: {} }
        : { notFound: true };
}
