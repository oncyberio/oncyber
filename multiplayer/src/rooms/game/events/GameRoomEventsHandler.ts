import { provesUser } from "../../../identity/oncyberToken";
import { Room } from "colyseus";

import { GameState } from "../schema/GameState";

import fetch from "node-fetch";
import { checkIsMod } from "../../../utils/isMod";

export function GameRoomEventHandlers(room: Room<GameState>) {
    room.onMessage("move", (client, data) => {
        room.state.players.get(client.sessionId)._onMoveMessage(data);
    });

    room.onMessage("init", (client, data) => {
        room.state.players.get(client.sessionId)._onInitMessage(data);
    });

    room.onMessage("VRM", (client, data) => {
        room.state.players.get(client.sessionId)._onVRMMessage(data);
    });

    room.onMessage("avatar", (client, data) => {
        room.state.players.get(client.sessionId)._onAvatarMessage(data);
    });

    room.onMessage("username", async (client, data) => {
        room.state.players.get(client.sessionId)._onUsernameMessage(data);
    });

    room.onMessage("login", async (client, data) => {
        const [token, username, avatar, walletId] = data;

        // A login message names any wallet; only a verified session counts.
        if (!provesUser(walletId, token)) return;

        room.state.disconnectDuplicatePlayer(walletId, "onLogin");

        room.state.players
            .get(client.sessionId)
            ._onLoginMessage(data, room.metadata);
    });

    room.onMessage("pause", (client, data) => {
        room.state.players.get(client.sessionId)._onPauseMessage(data);
    });

    room.onMessage("kick", async (client, data) => {
        const [token, sessionId] = data;

        const userToKick = room.clients?.find?.(
            (client) => client.sessionId === sessionId
        );

        if (userToKick) {
            const isMod = checkIsMod(
                room.state.players.get(client.sessionId).userId,
                room.metadata.exhibitId,
                token
            );

            if (isMod) {
                userToKick.send("kick");
            }
        }
    });
}
