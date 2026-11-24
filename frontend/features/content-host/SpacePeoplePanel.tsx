import React from "react";
import {
    SUMMON_COMMAND,
    useMultiplayer,
} from "@components/_3DExhibit-v2/context/MultiplayerProvider";
import { CHAT_TYPES } from "@components/_3DExhibit-v2/context/hooks/useChat";
import { useWorld } from "@components/_3DExhibit-v2/hooks/useWorld";
import {
    DEFAULT_SUMMON_RADIUS,
    TELEPORT_TO_USER,
} from "@components/_3DExhibit-v2/three/factory/multiplayer/constants";
import LobbyPeoplePanel from "@features/lobby/LobbyPeoplePanel";
import { spacePeople } from "./spacePeople";

/**
 * The lobby's People panel, listing the space's visitors. Moderators keep
 * the space's full tools (voice, kick, report) one step away.
 */
export default function SpacePeoplePanel({
    status,
    onClose,
    returnFocusRef,
}: {
    status: string;
    onClose(): void;
    returnFocusRef?: { current: HTMLElement | null };
}) {
    const { chat, room, MultiplayerService } = useMultiplayer();
    const world = useWorld();
    const players = spacePeople(chat.admins, chat.users, room.sessionId);
    const find = (id: string) =>
        [...(chat.admins || []), ...(chat.users || [])].find(
            (player) => player.sessionId === id
        );
    return (
        <LobbyPeoplePanel
            place="space"
            players={players}
            population={Math.max(players.length, room.numOfUsers || 0)}
            status={status}
            onClose={onClose}
            returnFocusRef={returnFocusRef}
            onGoTo={(id) => {
                const player = find(id);
                const response = world.current?.handleCommand({
                    type: TELEPORT_TO_USER,
                    payload: {
                        username: player?.userData?.username,
                        sessionId: id,
                    },
                }) as { success?: boolean; message?: string } | undefined;
                if (response && !response.success)
                    chat.pushMessage(response.message, CHAT_TYPES.ALERT.label);
                else onClose();
            }}
            onSummonAll={
                room.isMod
                    ? () => {
                          MultiplayerService.current?.sendCommand(
                              SUMMON_COMMAND,
                              {
                                  sessionId: room.sessionId,
                                  username: find(room.sessionId)?.userData
                                      ?.username,
                                  radius: DEFAULT_SUMMON_RADIUS,
                              }
                          );
                          onClose();
                      }
                    : undefined
            }
        />
    );
}
