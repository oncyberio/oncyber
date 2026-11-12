import type { NextApiRequest, NextApiResponse } from "next";
import { getExhibitById } from "./exhibit";
import { getUserProfilesByWalletIds } from "@utils/firestore/userProfiles";
import { readStaffPickIds, staffPickCurator } from "@utils/staffPicks";
import {
    buildSpaceInfo,
    buildSpaceLocation,
} from "@features/space-info/spaceInfo";
import { getDestinationBySlug } from "@utils/firestore/destinations";

/** Public facts about one space for the title sidebar, plus staff pick state. */
export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    if (req.method !== "GET") {
        res.setHeader("allow", "GET");
        return res.status(405).json({ error: "METHOD_NOT_ALLOWED" });
    }
    const id =
        typeof req.query.id === "string" ? req.query.id.slice(0, 200) : "";
    if (!id) return res.status(400).json({ error: "ID_REQUIRED" });
    res.setHeader("cache-control", "private, no-store");
    try {
        const [exhibit, picks, curator] = await Promise.all([
            getExhibitById(id),
            readStaffPickIds(),
            staffPickCurator(req),
        ]);
        if (
            !exhibit ||
            (exhibit as any).deleted ||
            (exhibit as any).isPublic === false
        )
            return res.status(404).json({ error: "NOT_FOUND" });
        const info = buildSpaceInfo(exhibit);
        // Resolve the deployer and artist wallets to oncyber usernames when they have one.
        const wallets = [
            info.deployer.address,
            ...info.artists.map((a) => a.address),
            ...info.collaborators.map((a) => a.address),
        ]
            .filter(Boolean)
            .slice(0, 40);
        const [profiles, destination] = await Promise.all([
            getUserProfilesByWalletIds(wallets).catch(() => []),
            info.room && !info.room.includes("/")
                ? getDestinationBySlug(info.room).catch(() => null)
                : null,
        ]);
        const byWallet = new Map(
            profiles.map((profile) => [
                String(profile?.walletId || "").toLowerCase(),
                profile,
            ])
        );
        const named = (address: string, fallback: string) => {
            const profile = byWallet.get((address || "").toLowerCase());
            return {
                name: profile?.username || fallback,
                avatar:
                    typeof profile?.avatar === "string" ? profile.avatar : "",
                href: profile?.username
                    ? `/${encodeURIComponent(profile.username)}`
                    : "",
            };
        };
        const location = buildSpaceLocation(destination, info.room);
        if (location?.author?.address)
            location.author = {
                ...location.author,
                ...named(location.author.address, location.author.name),
                href:
                    named(location.author.address, "").href ||
                    location.author.href,
            };
        return res.json({
            ...info,
            deployer: {
                ...info.deployer,
                ...named(info.deployer.address, info.deployer.name),
            },
            artists: info.artists.map((artist) => ({
                ...artist,
                ...named(artist.address, artist.name),
                avatar:
                    named(artist.address, artist.name).avatar || artist.avatar,
            })),
            artworks: info.artworks.map(({ artistAddress, ...artwork }) => {
                const profile = byWallet.get(
                    (artistAddress || "").toLowerCase()
                );
                return profile?.username
                    ? { ...artwork, artist: profile.username }
                    : artwork;
            }),
            collaborators: info.collaborators.map((person) => ({
                ...person,
                ...named(person.address, person.name),
            })),
            location,
            staffPick: picks.includes(id),
            staffPickCount: picks.length,
            canCurate: !!curator,
        });
    } catch (error) {
        console.error("space-info", error);
        return res.status(500).json({ error: "SPACE_INFO_UNAVAILABLE" });
    }
}
