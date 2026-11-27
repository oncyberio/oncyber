// One visitor in the chat and voice check (scripts/games/social-check.mjs).
// The page's real social layer (frontend/features/games/social/gameSocial.ts) runs
// here around the real game build in the site's sandbox. Only the network
// and the audio are stand-ins: rooms are BroadcastChannels shared by the
// visitors' pages, and a voice is a level sent on the room.
import {
    buildSocialHandoff,
    GameSocial,
    readSocialHandoff,
} from "/social/gameSocial.js";

const params = new URLSearchParams(location.search);
const GAME = params.get("game");
const name = params.get("name");
const selfId = `room-${name.toLowerCase()}`;

// --- the lobby: its chat log and voice, as LobbyConnection keeps them ----
const lobby = {
    channel: new BroadcastChannel("check-lobby"),
    messages: [],
    voiceState: "off",
    present: true,
};
lobby.channel.onmessage = ({ data }) => lobby.messages.push(data);

// --- a room: the chat channel echoes to everyone, the sender included ----
function joinRoom(label) {
    const channel = new BroadcastChannel(`check-room-${label}`);
    const room = {
        sessionId: selfId,
        label,
        names: new Map([[selfId, name]]),
        voice: "off",
        level: 0,
        heard: new Map(),
        gain: null,
        relayed: [],
        micRequests: 0,
        sendChat(packet) {
            const message = {
                kind: "chat-channel",
                from: selfId,
                server_ts: Date.now(),
                data: packet,
            };
            channel.postMessage(message);
            receive(message);
            return true;
        },
        peerName: (id) => room.names.get(id) || "",
        voiceState: () => room.voice,
        // Stands in for getUserMedia and publishing the microphone.
        async goLive() {
            room.micRequests++;
            room.voice = "live";
        },
        async listen() {
            if (room.voice === "off") room.voice = "muted";
        },
        voiceLevels() {
            const levels = [...room.heard];
            levels.push([selfId, room.voice === "live" ? room.level : 0]);
            return levels;
        },
        setVoiceGain(gain) {
            room.gain = gain;
        },
        speak(level) {
            room.level = level;
            if (room.voice === "live")
                channel.postMessage({ kind: "level", from: selfId, level });
        },
    };
    function receive(message) {
        if (message.kind === "hello") {
            room.names.set(message.from, message.name);
            if (!message.reply)
                channel.postMessage({
                    kind: "hello",
                    from: selfId,
                    name,
                    reply: true,
                });
        } else if (message.kind === "level")
            room.heard.set(message.from, message.level);
        else if (message.kind === "chat-channel") {
            // As GameRoom does: the page's layer first, the game only after.
            if (
                visitor.social.receive(
                    message.from,
                    message.data,
                    message.server_ts
                )
            )
                return;
            if (message.from !== selfId) {
                room.relayed.push(message.data);
                toGame("net", { from: message.from, data: message.data });
            }
        }
    }
    channel.onmessage = ({ data }) => receive(data);
    channel.postMessage({ kind: "hello", from: selfId, name });
    return room;
}

// --- the game frame, in the site's sandbox -------------------------------
// The one contract (docs/games/contract.md): every game says
// oncyber:game:<kind>; a build from before it says <id>:<kind>. Each message
// goes out in the form the game greeted in, as GamePage's send does.
const CONTRACT = window.GAME_MESSAGE_PREFIX;
const LEGACY = `${GAME}:`;
let prefix = LEGACY;
const kindOf = (type) =>
    typeof type !== "string"
        ? ""
        : type.startsWith(CONTRACT)
        ? type.slice(CONTRACT.length)
        : type.startsWith(LEGACY)
        ? type.slice(LEGACY.length)
        : "";
const posted = [];
let frame = null;
function toGame(kind, data = {}) {
    const message = { type: prefix + kind, ...data };
    posted.push(message);
    frame?.contentWindow?.postMessage(message, "*");
}

const visitor = {
    social: null,
    room: null,
    ready: false,
    gameError: "",
    fromGame: [],
    sayInLobby(text) {
        const message = { sessionId: selfId, name, text, sentAt: Date.now() };
        lobby.messages.push(message);
        lobby.channel.postMessage(message);
    },
    setLobbyVoice(state) {
        lobby.voiceState = state;
    },
    lobbyTexts: () => lobby.messages.map((message) => message.text),
    /** Travel into the game: what GamePage and the lobby do between them. */
    travel(label) {
        // The lobby answers the game page's request with its chat and voice,
        // then leaves its own voice (LobbyConnection.setLobbyPresence).
        const handoff = readSocialHandoff(
            JSON.parse(
                JSON.stringify(
                    buildSocialHandoff(lobby.messages, selfId, lobby.voiceState)
                )
            )
        );
        lobby.present = false;
        lobby.voiceState = "off";
        visitor.social = new GameSocial({ selfName: name, toGame });
        visitor.social.carry(handoff);
        frame = document.createElement("iframe");
        frame.setAttribute("sandbox", "allow-scripts allow-pointer-lock");
        frame.setAttribute("referrerpolicy", "no-referrer");
        frame.src = `/game-builds/${GAME}/index.html`;
        addEventListener("message", (event) => {
            if (event.source !== frame.contentWindow) return;
            const type = event.data?.type;
            const kind = kindOf(type);
            if (!kind) return;
            visitor.fromGame.push(kind);
            if (kind === "hello" && !visitor.greeted) {
                visitor.greeted = true;
                prefix = type.startsWith(CONTRACT) ? CONTRACT : LEGACY;
                toGame("identity", {
                    name,
                    pfp: "",
                    avatarUrl: "",
                });
                toGame("party", { party: null });
                // A contract game waits for its visit: a trip from the
                // lobby, alone.
                if (prefix === CONTRACT)
                    toGame("enter", {
                        arrival: { from: "lobby", view: null },
                        trip: null,
                    });
            } else if (kind === "ready" && !visitor.ready) {
                visitor.ready = true;
                toGame("entered");
                // The reveal: the visitor is in the game now.
                visitor.social.arrive();
            } else if (kind === "error")
                visitor.gameError = String(event.data.message || "error");
            else visitor.gameMessage(kind, event.data);
        });
        document.body.append(frame);
        visitor.room = joinRoom(label);
        visitor.social.attach(visitor.room);
        setInterval(() => visitor.social.tick(), 100);
    },
    /** A message from the game frame, routed as GamePage routes it. */
    gameMessage(kind, data) {
        if (kind === "voice") return visitor.social.setVoicePoses(data);
        if (kind === "net") {
            if (!visitor.social.allowsRelay(data.data)) return false;
            return visitor.room.sendChat(data.data);
        }
        return false;
    },
    report() {
        const { social, room } = visitor;
        return {
            id: selfId,
            ready: visitor.ready,
            gameError: visitor.gameError,
            messages:
                social?.state.messages.map(({ name, text, carried, self }) => ({
                    name,
                    text,
                    carried,
                    self,
                })) ?? [],
            talking: social?.state.talking ?? [],
            voice: room?.voice ?? "none",
            micRequests: room?.micRequests ?? 0,
            lobbyVoice: lobby.voiceState,
            relayed: room?.relayed ?? [],
            postedKinds: [
                ...new Set(posted.map((message) => kindOf(message.type))),
            ],
            posted: JSON.stringify(posted),
            fromGame: [...new Set(visitor.fromGame)],
        };
    },
    gainFor: (id) => visitor.room?.gain?.(id) ?? null,
};
window.visitor = visitor;
