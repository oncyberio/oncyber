"use strict";
Object.defineProperty(exports, "__esModule", { value: true });

/** Every status a group trip reports, in the order a trip moves through them. */
const LOBBY_TRAVEL_STATUSES = Object.freeze(["inviting", "preparing", "gathering", "travelling", "complete", "cancelled"]);
/** A finished trip stays on its group as a record; only a live trip can still change. */
const LOBBY_TRAVEL_TERMINAL_STATUSES = Object.freeze(["complete", "cancelled"]);

function isLobbyTravelStatus(value) {
    return LOBBY_TRAVEL_STATUSES.includes(value);
}
function isLobbyTravelTerminal(status) {
    return LOBBY_TRAVEL_TERMINAL_STATUSES.includes(status);
}
/** True while a trip can still be answered, prepared, launched or cancelled. */
function isLobbyTravelLive(status) {
    return !isLobbyTravelTerminal(status);
}

exports.LOBBY_TRAVEL_STATUSES = LOBBY_TRAVEL_STATUSES;
exports.LOBBY_TRAVEL_TERMINAL_STATUSES = LOBBY_TRAVEL_TERMINAL_STATUSES;
exports.isLobbyTravelStatus = isLobbyTravelStatus;
exports.isLobbyTravelTerminal = isLobbyTravelTerminal;
exports.isLobbyTravelLive = isLobbyTravelLive;
