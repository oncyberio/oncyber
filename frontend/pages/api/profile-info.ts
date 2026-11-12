import type { NextApiRequest, NextApiResponse } from "next";
import { db } from "@utils/firebaseAdmin";
import { getAccountDoc } from "@api/accounts/authenticate/utils/link";
import { openSeaJson } from "@utils/openSeaFetch";
import { toLandingCards } from "@features/landing-carousel/data";
import { profileNft, shortAddress } from "@features/space-info/spaceInfo";
import { resize } from "@utils/urlUtils";

/** Only what a sidebar card shows, with ~320px covers. */
const slimCards = (cards: ReturnType<typeof toLandingCards>) =>
    cards.map((card) => ({
        id: card.id,
        title: card.title,
        href: card.href,
        imageUrls: card.imageUrls.map((url) => resize(url, 320)),
    }));

const SPACE_FIELDS = [
    "visibility",
    "isPublic",
    "published",
    "mock",
    "deleted",
    "info",
    "owner",
    "number_of_visits",
    "createdAt",
];
const MAX_SPACES = 30;
const NFT_PAGE = 30;

async function findAccount(id: string) {
    const handle = id.replace(/^@/, "");
    if (/^0x[0-9a-f]{40}$/i.test(handle))
        return getAccountDoc(handle).catch(() => null);
    return (
        (await getAccountDoc(handle, null, "username").catch(() => null)) ||
        (await getAccountDoc(handle).catch(() => null))
    );
}

async function deployedSpaces(accountId: string, wallets: string[]) {
    const refs = await db
        .collection("users")
        .doc(accountId)
        .collection("exhibits")
        .limit(200)
        .get();
    if (!refs.size) return [];
    const docs = await db.getAll(
        ...refs.docs.map((doc) => db.collection("exhibits").doc(doc.id)),
        { fieldMask: SPACE_FIELDS }
    );
    const rows = docs
        .filter((doc) => doc.exists)
        .map((doc) => ({ id: doc.id, ...doc.data() }))
        // The subcollection also lists spaces they only edit.
        .filter((row: any) =>
            wallets.includes(String(row.owner || "").toLowerCase())
        )
        .sort(
            (a: any, b: any) =>
                (b.number_of_visits || 0) - (a.number_of_visits || 0)
        );
    return slimCards(toLandingCards(rows).slice(0, MAX_SPACES));
}

async function featuredIn(wallets: string[]) {
    if (!wallets.length) return [];
    const snap = await db
        .collection("exhibits")
        .where(
            "artistSearch.addresses",
            "array-contains-any",
            wallets.slice(0, 10)
        )
        .select(...SPACE_FIELDS)
        .limit(60)
        .get();
    const rows = snap.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }))
        .filter(
            (row: any) =>
                !wallets.includes(String(row.owner || "").toLowerCase())
        )
        .sort(
            (a: any, b: any) =>
                (b.number_of_visits || 0) - (a.number_of_visits || 0)
        );
    return slimCards(toLandingCards(rows).slice(0, MAX_SPACES));
}

async function ownedNfts(wallet: string, next: string) {
    let path = `chain/ethereum/account/${wallet}/nfts?limit=${NFT_PAGE}`;
    if (next) path += `&next=${encodeURIComponent(next)}`;
    const data = await openSeaJson(path);
    return {
        nfts: (data?.nfts || []).map(profileNft).filter(Boolean),
        next: typeof data?.next === "string" ? data.next : "",
    };
}

const collectionOwners = new Map<string, { ts: number; owner: string }>();
async function collectionOwner(slug: string) {
    const hit = collectionOwners.get(slug);
    if (hit && Date.now() - hit.ts < 6 * 60 * 60 * 1000) return hit.owner;
    const data = await openSeaJson(`collections/${slug}`).catch(() => null);
    const owner = String(data?.owner || "").toLowerCase();
    collectionOwners.set(slug, { ts: Date.now(), owner });
    return owner;
}

/**
 * Tokens from collections this wallet owns on OpenSea (i.e. created), found
 * through its mint events, newest first. OpenSea v2 has no "created by" NFT
 * filter, and plain mints also include airdrops from other artists.
 */
async function createdNfts(wallet: string, next: string) {
    const nfts = [];
    const seen = new Set<string>();
    let cursor = next;
    for (let page = 0; page < 3 && nfts.length < NFT_PAGE; page++) {
        const params = new URLSearchParams({ event_type: "mint", limit: "50" });
        if (cursor) params.set("next", cursor);
        const data = await openSeaJson(
            `events/accounts/${wallet}?${params.toString()}`
        );
        const events = (data?.asset_events || []).filter(
            (event) =>
                String(event?.to_address || "").toLowerCase() === wallet &&
                event?.nft
        );
        const slugs = Array.from(
            new Set(
                events
                    .map((event) => String(event.nft.collection || ""))
                    .filter((slug) => /^[a-z0-9_-]{1,100}$/.test(slug))
            )
        ).slice(0, 12) as string[];
        const owners = new Map(
            await Promise.all(
                slugs.map(
                    async (slug) => [slug, await collectionOwner(slug)] as const
                )
            )
        );
        for (const event of events) {
            if (owners.get(String(event.nft.collection)) !== wallet) continue;
            const nft = profileNft(event.nft);
            if (nft && !seen.has(nft.id)) {
                seen.add(nft.id);
                nfts.push(nft);
            }
        }
        cursor = typeof data?.next === "string" ? data.next : "";
        if (!cursor) break;
    }
    return { nfts, next: cursor };
}

/**
 * GET ?id=<wallet|username>            profile + deployed + featured in
 * GET ?id=…&nfts=owned|created[&next=] one page of NFTs (small thumbnails)
 */
export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    if (req.method !== "GET") {
        res.setHeader("allow", "GET");
        return res.status(405).json({ error: "METHOD_NOT_ALLOWED" });
    }
    const id =
        typeof req.query.id === "string" ? req.query.id.slice(0, 120) : "";
    if (!id) return res.status(400).json({ error: "ID_REQUIRED" });
    try {
        const account = await findAccount(id);
        const data = account?.data?.() || {};
        const handle = id.replace(/^@/, "");
        const wallet = String(
            data.walletId || (/^0x/i.test(handle) ? handle : "")
        ).toLowerCase();
        if (!account && !wallet)
            return res.status(404).json({ error: "NOT_FOUND" });
        const wallets = Array.from(
            new Set(
                [
                    wallet,
                    account?.id,
                    ...(Array.isArray(data.linkedAccounts)
                        ? data.linkedAccounts
                        : []),
                ]
                    .filter((value) => typeof value === "string" && value)
                    .map((value: string) => value.toLowerCase())
            )
        );
        const evm = /^0x[0-9a-f]{40}$/.test(wallet) ? wallet : "";
        const kind = req.query.nfts;
        if (kind === "owned" || kind === "created") {
            res.setHeader("cache-control", "public, max-age=60");
            if (!evm) return res.json({ nfts: [], next: "" });
            const next =
                typeof req.query.next === "string"
                    ? req.query.next.slice(0, 600)
                    : "";
            const page =
                kind === "owned"
                    ? await ownedNfts(evm, next)
                    : await createdNfts(evm, next);
            return res.json(page);
        }
        const [spaces, featured] = await Promise.all([
            account ? deployedSpaces(account.id, wallets) : [],
            featuredIn(
                wallets.filter((value) => /^0x[0-9a-f]{40}$/.test(value))
            ),
        ]);
        res.setHeader("cache-control", "public, max-age=60");
        return res.json({
            id: account?.id || wallet,
            name:
                (typeof data.username === "string" && data.username) ||
                shortAddress(wallet),
            username: typeof data.username === "string" ? data.username : "",
            wallet,
            avatar: typeof data.avatar === "string" ? data.avatar : "",
            href: data.username
                ? `/${encodeURIComponent(data.username)}`
                : `/${encodeURIComponent(wallet)}`,
            hasNfts: !!evm,
            spaces,
            featured,
            spacesTotal: spaces.length,
        });
    } catch (error) {
        console.error("profile-info", error);
        return res.status(500).json({ error: "PROFILE_UNAVAILABLE" });
    }
}
