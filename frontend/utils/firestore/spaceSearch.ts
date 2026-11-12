import { artistQueryKey, matchesArtistNames } from "@utils/artistSearch";
import { normalizeSearch, matchesSearchText } from "@utils/searchText";
export { normalizeSearch } from "@utils/searchText";
import { firestore } from "firebase-admin";
import { db } from "@utils/firebaseAdmin";
import type { DiscoveryFilters } from "@features/landing-carousel/types";

const BATCH_SIZE = 20;
const ROOMS = ["brute", "coal", "chalk", "altitude", "rtfktspacepod"];
const INFO_FIELDS = [
    "headline",
    "description",
    "curator",
    "customLink",
    "room",
    "heroImg",
    "cHeroImg",
    "fHeroImg",
    "thumbnailOrientation",
];
const FIELDS = [
    ...INFO_FIELDS.map((field) => `info.${field}`),
    "owner",
    "tags",
    "chains",
    "collections",
    "artistSearch.names",
    "artistSearch.curatorNames",
    "artistSearch.addresses",
    "number_of_visits",
    "visibility",
    "isPublic",
    "published",
    "mock",
    "deleted",
    "info.visibility",
    "info.private",
];
type Stream = {
    field: string;
    prefix?: string;
    op?: "==" | "array-contains" | "in";
    value?: any;
};
type Position = { after?: [string, string]; done?: boolean };

export function titlePrefixes(query: string) {
    // Raw legacy titles have no lowercase index. Query common stored casing,
    // using existing single-field indexes, without a catalogue scan/backfill.
    const raw = query.trim().replace(/\s+/g, " ");
    const withoutEdition = raw.replace(
        /\s+(?:(?:№|#|n[°º]|no\.?|n)\s*)?\d+$/i,
        ""
    );
    const base = withoutEdition || raw;
    const lower = base.toLowerCase();
    return [
        ...new Set([
            base,
            lower,
            lower.replace(
                /(^|\s)(\S)/g,
                (_, space, char) => space + char.toUpperCase()
            ),
            lower.charAt(0).toUpperCase() + lower.slice(1),
            base.toUpperCase(),
        ]),
    ];
}
export function searchStreams(filters: DiscoveryFilters): Stream[] {
    const q = filters.q.trim();
    if (q) {
        if (/^0x[a-f\d]{40}$/i.test(q))
            return [
                { field: "owner", op: "==", value: q.toLowerCase() },
                {
                    field: "artistSearch.addresses",
                    op: "array-contains",
                    value: q.toLowerCase(),
                },
            ];
        const prefixes = titlePrefixes(q);
        const artistKey = artistQueryKey(q);
        return [
            ...(artistKey.length >= 2
                ? [
                      {
                          field: "artistSearch.terms",
                          op: "array-contains" as const,
                          value: Array.from(artistKey).slice(0, 64).join(""),
                      },
                  ]
                : []),
            ...prefixes.map((prefix) => ({ field: "info.headline", prefix })),
            ...prefixes.map((prefix) => ({ field: "info.curator", prefix })),
            {
                field: "info.customLink",
                prefix: q.toLowerCase().replace(/\s+/g, ""),
            },
            ...(q.includes(" ")
                ? [
                      {
                          field: "info.customLink",
                          prefix: q.toLowerCase().replace(/\s+/g, "-"),
                      },
                  ]
                : []),
        ];
    }
    if (filters.owner)
        return [
            { field: "owner", op: "==", value: filters.owner.toLowerCase() },
        ];
    if (filters.chain)
        return [
            { field: "chains", op: "array-contains", value: filters.chain },
        ];
    if (filters.collection)
        return [
            {
                field: "collections",
                op: "array-contains",
                value: filters.collection,
            },
        ];
    if (filters.category === "oncyberlabs")
        return [{ field: "info.room", op: "in", value: ROOMS }];
    return [];
}
export function matchesSpaceSearch(data: any, filters: DiscoveryFilters) {
    if (
        data.mock ||
        data.deleted ||
        data.isPublic === false ||
        data.published === false ||
        data.info?.private ||
        ["private", "unlisted", "draft"].includes(
            data.visibility || data.info?.visibility
        )
    )
        return false;
    const info = data.info || {};
    // Public worlds without a preview use the discovery grid's local cover.
    const text = normalizeSearch(
        [info.headline, info.curator, info.customLink, data.owner]
            .filter(Boolean)
            .join(" ")
    );
    return (
        (matchesSearchText(text, filters.q) ||
            matchesArtistNames(
                data.artistSearch?.names,
                data.artistSearch?.addresses,
                filters.q
            ) ||
            matchesArtistNames(
                data.artistSearch?.curatorNames,
                [],
                filters.q
            )) &&
        (!filters.owner ||
            data.owner?.toLowerCase() === filters.owner.toLowerCase()) &&
        (!filters.chain || data.chains?.includes(filters.chain)) &&
        (!filters.collection ||
            data.collections?.includes(filters.collection)) &&
        (filters.category !== "oncyberlabs" || ROOMS.includes(info.room))
    );
}
function publicCard(doc: any) {
    const data = doc.data();
    const info = Object.fromEntries(
        INFO_FIELDS.filter((field) => data.info?.[field] !== undefined).map(
            (field) => [field, data.info[field]]
        )
    );
    if (typeof info.description === "string")
        info.description = info.description.slice(0, 500);
    return {
        id: doc.id,
        info,
        owner: data.owner || "",
        number_of_visits: Number(data.number_of_visits) || 0,
        tags: data.tags || [],
        chains: data.chains || [],
        collections: data.collections || [],
        artistSearch: {
            curatorNames: Array.isArray(data.artistSearch?.curatorNames)
                ? data.artistSearch.curatorNames
                : [],
            names: Array.isArray(data.artistSearch?.names)
                ? data.artistSearch.names
                : [],
            addresses: Array.isArray(data.artistSearch?.addresses)
                ? data.artistSearch.addresses
                : [],
        },
    };
}
export function decodeSearchCursor(
    cursor: string,
    key: string,
    streams: Stream[]
): Position[] {
    if (!cursor) return streams.map(() => ({}));
    try {
        if (cursor.length > 12000) throw Error();
        const parsed = JSON.parse(Buffer.from(cursor, "base64url").toString());
        if (parsed.key !== key || parsed.positions.length !== streams.length)
            throw Error();
        parsed.positions.forEach((position: Position, i: number) => {
            if (
                position.done !== undefined &&
                typeof position.done !== "boolean"
            )
                throw Error();
            if (
                position.after &&
                (!Array.isArray(position.after) ||
                    position.after.length !== 2 ||
                    position.after.some(
                        (value) =>
                            typeof value !== "string" || value.length > 400
                    ) ||
                    !position.after[1] ||
                    position.after[1].includes("/") ||
                    (streams[i].prefix &&
                        !position.after[0].startsWith(streams[i].prefix)))
            )
                throw Error();
        });
        return parsed.positions;
    } catch {
        throw new Error("Invalid search cursor");
    }
}
const cache = new Map<string, { expires: number; value: Promise<any> }>();

export async function searchSpaces(filters: DiscoveryFilters, cursor = "") {
    const streams = searchStreams(filters);
    const key = JSON.stringify(filters);
    const positions = decodeSearchCursor(cursor, key, streams);
    if (!streams.length) return { exhibits: [], cursor: "", hasMore: false };
    const cacheKey = key + cursor;
    const hit = cache.get(cacheKey);
    if (hit && hit.expires > Date.now()) return hit.value;
    const value = query();
    cache.set(cacheKey, { expires: Date.now() + 15000, value });
    if (cache.size > 100) cache.delete(cache.keys().next().value);
    try {
        return await value;
    } catch (error) {
        cache.delete(cacheKey);
        throw error;
    }

    async function query() {
        const batches = await Promise.all(
            streams.map(async (stream, i) => {
                if (positions[i].done) return [];
                let query = db.collection("exhibits").select(...FIELDS);
                if (stream.prefix !== undefined) {
                    query = query
                        .where(stream.field, ">=", stream.prefix)
                        .where(stream.field, "<=", stream.prefix + "\uf8ff")
                        .orderBy(stream.field)
                        .orderBy(firestore.FieldPath.documentId());
                    if (positions[i].after)
                        query = query.startAfter(...positions[i].after);
                } else {
                    query = query
                        .where(stream.field, stream.op, stream.value)
                        .orderBy(firestore.FieldPath.documentId());
                    if (positions[i].after)
                        query = query.startAfter(positions[i].after[1]);
                }
                const snapshot = await query.limit(BATCH_SIZE).get();
                const last = snapshot.docs[snapshot.docs.length - 1];
                positions[i] = {
                    done: snapshot.size < BATCH_SIZE,
                    ...(last
                        ? {
                              after: [
                                  stream.prefix !== undefined
                                      ? last.get(stream.field)
                                      : "",
                                  last.id,
                              ] as [string, string],
                          }
                        : {}),
                };
                return snapshot.docs
                    .filter((doc) => matchesSpaceSearch(doc.data(), filters))
                    .map(publicCard);
            })
        );
        const exhibits = [
            ...new Map(batches.flat().map((card) => [card.id, card])).values(),
        ].sort((a, b) =>
            String(a.info.headline).localeCompare(
                String(b.info.headline),
                undefined,
                { numeric: true, sensitivity: "base" }
            )
        );
        const hasMore = positions.some((position) => !position.done);
        return {
            exhibits,
            hasMore,
            cursor: hasMore
                ? Buffer.from(JSON.stringify({ key, positions })).toString(
                      "base64url"
                  )
                : "",
        };
    }
}
