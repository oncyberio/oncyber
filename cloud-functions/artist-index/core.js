const { createHash } = require("node:crypto");
const defaultRegistry = require("./artists.json");
const VERSION = 1;
const MAX_NAMES = 512;
const MAX_TERMS = 5000;
const MAX_PREFIX = 64;
const text = (value) =>
    typeof value === "string" ? Array.from(value.trim()).slice(0, 160).join("") : "";
const unique = (values) => [...new Set(values.filter(Boolean))].sort();
function normalizeArtist(value) {
    return text(value)
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]/gu, "");
}
function address(value) {
    const s = text(value);
    if (/^0x[a-f\d]{40}$/i.test(s)) return s.toLowerCase();
    if (
        /^tz[123][1-9A-HJ-NP-Za-km-z]{33}$/.test(s) ||
        /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(s)
    )
        return s;
    return "";
}
function chainName(value) {
    const name = text(value).toLowerCase();
    return (
        {
            default: "ethereum",
            eth: "ethereum",
            polygon: "matic",
            mainnet: "ethereum",
        }[name] || name
    );
}
function canonical(value) {
    if (Array.isArray(value)) return value.map(canonical);
    if (value && typeof value === "object")
        return Object.fromEntries(
            Object.keys(value)
                .sort()
                .map((key) => [key, canonical(value[key])])
        );
    return value;
}
const hash = (value) =>
    createHash("sha256")
        .update(JSON.stringify(canonical(value)))
        .digest("hex");
function isPublicGallery(data) {
    return (
        !!data &&
        !data.mock &&
        !data.deleted &&
        data.isPublic !== false &&
        data.published !== false &&
        !data.info?.private &&
        !["private", "unlisted", "draft"].includes(
            data.visibility || data.info?.visibility
        )
    );
}
function creatorRecord(value, source) {
    if (typeof value === "string")
        value = address(value) ? { address: value } : { username: value };
    if (!value || typeof value !== "object") return null;
    const names = unique(
        [value.username, value.user?.username, value.name]
            .map(text)
            .filter(
                (name) =>
                    name &&
                    !address(name) &&
                    !/^(unknown|anonymous|null|none)$/i.test(name)
            )
    );
    const wallet = address(value.address);
    return names.length || wallet ? { names, address: wallet, source } : null;
}
function extractCreators(asset, source = "stored-creator") {
    // The upload flow labels the uploader as creator. That is not artist attribution.
    const upload =
        ["none", "no-chain", "upload"].includes(asset?.blockchain) ||
        asset?.source?.blockchain === "none";
    const records = upload ? [] : [creatorRecord(asset?.creator, source)];
    for (const creator of !upload && Array.isArray(asset?.creators)
        ? asset.creators
        : [])
        records.push(creatorRecord(creator, source));
    for (const trait of Array.isArray(asset?.traits) ? asset.traits : []) {
        if (
            /^(artist|artist name|creator|created by)$/i.test(
                text(trait.trait_type)
            )
        )
            records.push(
                creatorRecord(
                    trait.value,
                    source.replace("creator", "artist-trait")
                )
            );
    }
    return records.filter(Boolean);
}
function artworkInputs(gallery) {
    return Object.entries(gallery?.artworks || {})
        .flatMap(([id, artwork]) => {
            if (
                !artwork ||
                artwork.visible === false ||
                artwork.data?.visible === false
            )
                return [];
            const data = artwork.data || {};
            // Ignore empty frames, text labels and other non-art placeholders.
            if (
                data.token_id == null &&
                data.identifier == null &&
                !data.creator &&
                !data.creators &&
                !data.image_url &&
                !data.animation_url
            )
                return [];
            const chain = chainName(
                data.blockchain || data.source?.blockchain || data.marketplace
            );
            const contract = address(
                data.contract_address ||
                    data.token_address ||
                    data.asset_contract?.address ||
                    data.contract?.address ||
                    data.contract
            );
            // Preserve token zero and large token IDs without unsafe numeric coercion.
            const rawToken = data.token_id ?? data.identifier;
            const tokenId =
                typeof rawToken === "string" ||
                (typeof rawToken === "number" && Number.isSafeInteger(rawToken))
                    ? String(rawToken)
                    : "";
            const nft =
                chain && contract && /^\d{1,100}$/.test(tokenId)
                    ? { chain, contract, tokenId }
                    : null;
            return [{ id, chain, nft, creators: extractCreators(data) }];
        })
        .sort((a, b) => a.id.localeCompare(b.id));
}
function sourceHash(gallery, registry = defaultRegistry) {
    return hash({
        version: VERSION,
        public: isPublicGallery(gallery),
        owner: address(gallery?.owner),
        artworks: artworkInputs(gallery),
        registry,
    });
}
function knownNames(record, chain, registry = defaultRegistry) {
    const keys = record.names.map(normalizeArtist);
    const artist = registry.artists.find(
        (entry) =>
            [entry.name, ...entry.aliases].some((name) =>
                keys.includes(normalizeArtist(name))
            ) ||
            entry.wallets.some(
                (wallet) =>
                    wallet.evidence &&
                    chainName(wallet.chain) === chain &&
                    address(wallet.address) === record.address &&
                    record.address
            )
    );
    return unique([
        ...record.names,
        ...(artist ? [artist.name, ...artist.aliases] : []),
    ]);
}
function attributedCreators(nft, registry = defaultRegistry) {
    if (!nft) return [];
    return registry.attributions
        .filter(
            (item) =>
                item.evidence &&
                chainName(item.chain) === nft.chain &&
                address(item.contract) === nft.contract &&
                (item.tokenId === undefined ||
                    String(item.tokenId) === nft.tokenId)
        )
        .flatMap((item) =>
            item.artistIds.flatMap((id) => {
                const artist = registry.artists.find(
                    (entry) => entry.id === id
                );
                return artist
                    ? [
                          {
                              names: [artist.name, ...artist.aliases],
                              address: "",
                              source: "curated-attribution",
                              evidence: item.evidence,
                          },
                      ]
                    : [];
            })
        );
}
function buildIndex(gallery, resolved = new Map(), registry = defaultRegistry) {
    const inputs = isPublicGallery(gallery) ? artworkInputs(gallery) : [];
    const names = [],
        addresses = [],
        unresolved = [],
        evidence = [];
    for (const input of inputs) {
        const remote = resolved.get(input.id);
        const curated = attributedCreators(input.nft, registry);
        const storedWallets = input.creators
            .filter((record) => record.source === "stored-creator")
            .map((record) => record.address)
            .filter(Boolean);
        const remoteWallets = (remote?.creators || [])
            .filter((record) => record.source === "opensea-creator")
            .map((record) => record.address)
            .filter(Boolean);
        const conflict =
            storedWallets.length &&
            remoteWallets.length &&
            !storedWallets.some((wallet) => remoteWallets.includes(wallet));
        const records = curated.length
            ? curated
            : conflict
            ? []
            : [...input.creators, ...(remote?.creators || [])];
        const artworkNames = [];
        for (const record of records) {
            const aliases = knownNames(record, input.chain, registry);
            names.push(...aliases);
            artworkNames.push(...aliases);
            if (record.address) addresses.push(record.address);
            evidence.push({ artworkId: input.id, ...record, names: aliases });
        }
        if (!artworkNames.length)
            unresolved.push({
                artworkId: input.id,
                nft: input.nft,
                reason: conflict
                    ? "creator-conflict-needs-review"
                    : remote?.reason ||
                      (records.length
                          ? "creator-name-missing"
                          : "creator-missing"),
            });
    }
    const allNames = unique(names),
        allAddresses = unique(addresses);
    const keptNames = allNames.slice(0, MAX_NAMES),
        keptAddresses = allAddresses.slice(0, MAX_NAMES);
    // Known gallery makers remain distinct from the artists of displayed works.
    const curatorNames = isPublicGallery(gallery)
        ? unique(
              registry.artists
                  .filter((artist) =>
                      artist.wallets.some(
                          (wallet) =>
                              wallet.evidence &&
                              address(wallet.address) ===
                                  address(gallery.owner) &&
                              address(gallery.owner)
                      )
                  )
                  .flatMap((artist) => [artist.name, ...artist.aliases])
          )
        : [];
    const searchNames = [...keptNames, ...curatorNames];
    const fullTerms = unique(searchNames.map(normalizeArtist));
    const terms = new Set(fullTerms);
    // Word prefixes let "butcher" match Jack Butcher; compact prefixes handle @ / _ / spaces.
    for (const name of searchNames) {
        const words = text(name)
            .split(/[^\p{L}\p{N}]+/u)
            .filter(Boolean);
        for (const term of unique([
            normalizeArtist(name),
            ...words.map(normalizeArtist),
        ])) {
            const characters = Array.from(term);
            for (let i = 2; i <= Math.min(characters.length, MAX_PREFIX); i++) {
                if (terms.size < MAX_TERMS)
                    terms.add(characters.slice(0, i).join(""));
            }
        }
    }
    const truncated =
        allNames.length > MAX_NAMES ||
        allAddresses.length > MAX_NAMES ||
        terms.size >= MAX_TERMS;
    return {
        index: {
            version: VERSION,
            sourceHash: sourceHash(gallery, registry),
            names: keptNames,
            curatorNames,
            addresses: keptAddresses,
            terms: [...terms].sort(),
            artworkCount: inputs.length,
            unresolvedCount: unresolved.length,
            truncated,
        },
        unresolved,
        evidence,
    };
}
function validateRegistry(registry) {
    if (
        !registry ||
        !Array.isArray(registry.artists) ||
        !Array.isArray(registry.attributions)
    )
        throw new Error("Invalid artist registry");
    const ids = new Set();
    for (const artist of registry.artists) {
        if (
            !text(artist.id) ||
            ids.has(artist.id) ||
            !text(artist.name) ||
            !Array.isArray(artist.aliases) ||
            artist.aliases.some((alias) => !text(alias)) ||
            !Array.isArray(artist.wallets)
        )
            throw new Error("Invalid artist registry entry");
        ids.add(artist.id);
        for (const wallet of artist.wallets)
            if (
                !chainName(wallet.chain) ||
                !address(wallet.address) ||
                !text(wallet.evidence)
            )
                throw new Error(
                    "Artist wallets require a chain, address and evidence"
                );
    }
    for (const entry of registry.attributions) {
        if (
            !chainName(entry.chain) ||
            !address(entry.contract) ||
            !text(entry.evidence) ||
            !Array.isArray(entry.artistIds) ||
            !entry.artistIds.length ||
            entry.artistIds.some((id) => !ids.has(id)) ||
            (entry.tokenId !== undefined &&
                (typeof entry.tokenId !== "string" ||
                    !/^\d{1,100}$/.test(entry.tokenId)))
        )
            throw new Error("Invalid reviewed NFT attribution");
    }
    return registry;
}
module.exports = {
    validateRegistry,
    VERSION,
    MAX_PREFIX,
    normalizeArtist,
    address,
    chainName,
    hash,
    isPublicGallery,
    creatorRecord,
    extractCreators,
    artworkInputs,
    sourceHash,
    knownNames,
    attributedCreators,
    buildIndex,
    defaultRegistry,
};
