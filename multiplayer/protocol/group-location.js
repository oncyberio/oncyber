"use strict";

/** Bounded group-only presence metadata. It is never an admission credential. */
function readGroupLocation(value) {
    if (!value || typeof value !== "object" || Array.isArray(value) || !["lobby", "travelling", "space"].includes(value.state)) return null;
    if (value.destination === undefined) return { state: value.state };
    if (value.state === "lobby") return null;
    const destination = value.destination;
    if (!destination || typeof destination !== "object" || typeof destination.id !== "string" || !/^[a-z0-9@_-]{1,128}$/i.test(destination.id) || typeof destination.title !== "string" || !destination.title.trim() || destination.title.length > 80 || typeof destination.href !== "string" || !/^\/(?:spaces\/|mints\/)?[a-z0-9@_-]{1,128}\/?$/i.test(destination.href)) return null;
    return { state: value.state, destination: { id: destination.id, title: destination.title.trim(), href: destination.href } };
}
exports.readGroupLocation = readGroupLocation;
