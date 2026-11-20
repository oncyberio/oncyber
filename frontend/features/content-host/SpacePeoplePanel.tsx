import React from "react";
import styled from "styled-components";
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
    onModerate,
    returnFocusRef,
}: {
    status: string;
    onClose(): void;
    /** Opens the space's moderation list. */
    onModerate(): void;
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
        >
            {room.isMod && (
                <Moderate type="button" onClick={onModerate}>
                    Moderate people
                    <small>Voice, kick and report</small>
                </Moderate>
            )}
        </LobbyPeoplePanel>
    );
}

const Moderate = styled.button`
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
    width: 100%;
    padding: 10px 12px;
    border: 1px solid #ffffff18;
    border-radius: 10px;
    background: #ffffff08;
    color: #f3f3f1;
    font: inherit;
    font-size: 12px;
    text-align: left;
    cursor: pointer;
    small {
        color: #a4adbb;
        font-size: 11px;
    }
    &:hover {
        background: #ffffff10;
    }
`;
