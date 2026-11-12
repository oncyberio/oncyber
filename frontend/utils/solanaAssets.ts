import { Connection, programs } from "@metaplex/js";
import {
    ParsedAccountData,
    PublicKey,
    TokenAccountBalancePair,
} from "@solana/web3.js";
import { nodeEnv } from "../env";
import { CollectionData } from "@uitypes/experience";
import { isSolanaAddress } from "./getAddrType";
import { Failure, firstMatch, getJSON, postJSON, Result, Success } from "./js";
import { extToMime, supportedMimes } from "./mimeUtils";

// Metaplex paginates getMultipleAccounts calls at this size
const SOLANA_PAGE_SIZE = 99;

const DAS_PAGE_SIZE = 40;

const METADATA_PUBKEY = new PublicKey(
    "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"
);

async function getOwners(connection: Connection, mint: string) {
    const pubKey = new PublicKey(mint);
    let rawData = await connection.getTokenLargestAccounts(pubKey);
    let maxOwner: TokenAccountBalancePair;
    rawData.value.forEach((v) => {
        if (maxOwner == null || maxOwner.uiAmount < v.uiAmount) {
            maxOwner = v;
        }
    });
    // For now we limit the result to the top owner to avoid issuing too many requests
    let data = await Promise.all([
        [maxOwner].map(async (v) => {
            let info = await connection.getParsedAccountInfo(v.address);

            return {
                tokenAccount: v.address.toString(),
                // TODO: enable when we figure out how to get the "physical" owner of the token account
                owner: (info.value.data as ParsedAccountData).parsed.info.owner,
                amount: v.uiAmount,
            };
        }),
    ]);

    // let data = rawData.value.map((v) => {
    //     return {
    //         address: v.address.toString(),
    //         amount: v.uiAmount,
    //     };
    // });
    return data;
}

const metadata = programs.metadata;
const TokenAccount = programs.core.TokenAccount;
const Metadata = metadata.Metadata;
const MetadataData = metadata.MetadataData;

async function getAssetsMetadata(
    connection: Connection,
    mints: programs.core.AnyPublicKey[]
) {
    const metadataPdaLookups = mints.map((m) => Metadata.getPDA(m));
    const metadataAddresses = await Promise.all(metadataPdaLookups);
    const tokenInfo = await Metadata.getInfos(connection, metadataAddresses);
    const data = Array.from(tokenInfo.values()).map((m) =>
        MetadataData.deserialize(m.data)
    );
    const dataWithURI = data.filter((m) => m.data.uri);
    return dataWithURI;
}

async function getAssets(
    connection: Connection,
    mints: programs.core.AnyPublicKey[]
) {
    //

    const dataWithURI = await getAssetsMetadata(connection, mints);

    return Promise.all(
        dataWithURI.map((m, index) =>
            fetch(m.data.uri).then(async (resp) => {
                if (!resp.ok) {
                    console.error(
                        "wow an error happened while fetching solana assets."
                    );
                    throw new Error("API Client Error");
                }
                let nftData = await resp.json();
                nftData.mint = dataWithURI[index].mint;
                nftData.amount = 1;
                // nftData.meta = metadata[index].toJSON();
                return nftData;
            })
        )
    );
}

async function getMetadataByOwner(
    connection: Connection,
    owner: string,
    page: number
) {
    // const accounts = await TokenAccount.getTokenAccountsByOwner(
    //     connection,
    //     owner
    // );
    // const nftAccounts = accounts
    //     .filter((acc) => acc.data?.amount?.toNumber() === 1)
    //     .slice(offset, offset + limit);

    // const assets = await getAssets(
    //     connection,
    //     nftAccounts.map((acc) => acc.data.mint)
    // );

    // return { assets, nftAccounts };

    return dasAssetPage(
        await dasRequest("getAssetsByOwner", { ownerAddress: owner }, page),
        page
    );
}

async function getMetadataByCreator(
    connection: Connection,
    creator: string,
    page: number
) {
    // Old code for fetching created assets. Now we use the DAS API
    // let metadata = await Metadata.findMany(connection, {
    //     creators: [creator],
    // });
    // console.log("getMetadataByCreator/Metadata.findMany", creator, metadata);

    // metadata = metadata.slice(offset, offset + limit);
    // For some tokens with huge supplies, findMany returns as much items as there're on supply
    // possibly because they're different mints
    // TODO: figure out how to detect master editions without querying account info for
    //       each account.
    // For now we use the uri field as a descriminator
    // const uniquesMap = {};
    // metadata.forEach((m) => {
    //     const uri = m.data.data.uri;
    //     if (uri && !uniquesMap[uri]) {
    //         uniquesMap[uri] = m;
    //     }
    // });
    // const dataWithURI = await getMetadata(
    //     connection,
    //     qnNfts.result.assets.map((asset) => asset.tokenAddress)
    // );

    // const assets = await Promise.all(
    //     dataWithURI.map(async (m) => {
    //         let [nftData, owners] = await Promise.all([
    //             fetch(m.data.uri).then((resp) => resp.json()),
    //             getOwners(connection, m.mint),
    //         ]);
    //         console.log("getMetadataByCreator/getOwners", creator, owners);
    //         nftData.mint = m.mint;
    //         // see https://github.com/solana-labs/solana-program-library/issues/2515
    //         nftData.owners = owners;
    //         return nftData;
    //     })
    // );
    return dasAssetPage(
        await dasRequest(
            "getAssetsByCreator",
            { creatorAddress: creator, onlyVerified: true },
            page
        ),
        page
    );
}

/**
 * Owned and created NFT listings use the standard Metaplex DAS API
 * (getAssetsByOwner / getAssetsByCreator). Set NEXT_PUBLIC_SOLANA_RPC to an
 * RPC that supports DAS; the public mainnet endpoint does not, so listings
 * come back empty there.
 */
async function dasRequest(
    method: string,
    params: Record<string, unknown>,
    page = 0
) {
    try {
        return await postJSON(nodeEnv.SOLANA_NETWORK, {
            jsonrpc: "2.0",
            id: 1,
            method,
            params: { ...params, page: page + 1, limit: DAS_PAGE_SIZE },
        });
    } catch {
        return null;
    }
}

function dasAssetPage(response: any, page: number) {
    const items: any[] = response?.result?.items || [];
    const uniques = {};
    items.forEach((asset) => {
        const metadata = asset.content?.metadata || {};
        const image =
            asset.content?.links?.image || asset.content?.files?.[0]?.uri;
        const key = `${metadata.name}-${image}`;
        if (uniques[key]) return;
        const collection = asset.grouping?.find(
            (group) => group.group_key === "collection"
        );
        uniques[key] = {
            image,
            name: metadata.name,
            description: metadata.description,
            mint: asset.id,
            collection: {
                name: collection?.collection_metadata?.name,
                address: collection?.group_value,
            },
            properties: {
                creators: asset.creators?.map(({ address }) => ({ address })),
            },
            needsRefetch: true,
        };
    });
    return {
        assets: Object.values(uniques),
        pageNumber: page + 1,
        totalAssets: items.length,
        totalPages: items.length < DAS_PAGE_SIZE ? page + 1 : page + 2,
    };
}

export async function fetchOwnedSolanaAssets(account: string, page = 0) {
    try {
        const connection = new Connection(nodeEnv.SOLANA_NETWORK, "confirmed");

        let { assets, totalPages, pageNumber } = await getMetadataByOwner(
            connection,
            account,
            page
        );
        return {
            assets: assets?.map((asset) => formatSolanaAsset(asset, account)),
            hasError: false,
            hasMore: pageNumber < totalPages,
            error: null,
        };
    } catch (error) {
        console.error(error);
        return {
            hasError: true,
            error,
        };
    }
}

export async function fetchCreatedSolanaAssets(creatorId: string, page = 0) {
    let assets = [];
    let result;

    try {
        const connection = new Connection(nodeEnv.SOLANA_NETWORK, "confirmed");

        do {
            result = await getMetadataByCreator(connection, creatorId, page++);

            assets = assets.concat(
                result.assets.map((asset) => formatSolanaAsset(asset, ""))
            );
        } while (result.pageNumber < result.totalPages);

        return {
            assets,
            hasError: false,
            hasMore: false,
            error: null,
        };
    } catch (err) {
        console.error(err);
        return {
            assets,
            hasError: true,
            hasMore: false,
            error: "Something weird with solana is happening...",
        };
    }
}

export async function fetchSolanaAssetById(account: string, mint: string) {
    try {
        const connection = new Connection(nodeEnv.SOLANA_NETWORK, "confirmed");

        const assets = await getAssets(connection, [mint]);
        if (assets.length === 0) return { success: false };
        return {
            success: true,
            asset: formatSolanaAsset(assets[0], account),
        };
    } catch (error) {
        return {
            success: false,
            error,
        };
    }
}

interface SolanaFileAttr {
    type: string;
    uri: string;
}

function getSolanaMime(asset, url: string) {
    let mime = asset.properties?.files?.find(
        (it: SolanaFileAttr) => it.uri === url
    )?.type;
    if (!supportedMimes.includes(mime)) {
        // Some assets return extension in properties instead of mime_type
        mime = extToMime[mime];
    }
    return mime;
}

function getSolanaMediaInfo(asset): { url: string; mime: string } {
    // 1- should be the preferred way to specify media info for videos, audio, model ...
    if (asset.animation_url) {
        return {
            url: asset.animation_url,
            mime: getSolanaMime(asset, asset.animation_url),
        };
    }
    // 2- No animation_url was provided, look for animation files in this order
    //     3D models, then Videos, then audios, then html
    let files: SolanaFileAttr[] = asset.properties?.files;
    if (files) {
        let file =
            files.find(
                (it) =>
                    it.type?.startsWith("model/gltf") ||
                    extToMime[it.type]?.startsWith("model/gltf")
            ) ||
            files.find(
                (it) =>
                    it.type?.startsWith("video") ||
                    extToMime[it.type]?.startsWith("video")
            ) ||
            files.find(
                (it) =>
                    it.type?.startsWith("audio") ||
                    extToMime[it.type]?.startsWith("audio")
            ) ||
            files.find(
                (it) =>
                    it.type?.startsWith("text/html") ||
                    extToMime[it.type]?.startsWith("text/html")
            );
        if (file) {
            return {
                url: file.uri,
                mime: supportedMimes.includes(file.type)
                    ? file.type
                    : extToMime[file.type],
            };
        }
    }
    return {
        url: asset.image,
        mime: getSolanaMime(asset, asset.image),
    };
}

export function formatSolanaAsset(asset, ownerId) {
    let { url, mime } = getSolanaMediaInfo(asset);

    const payload = {
        image_preview_url: asset.image,
        image_url: asset.image,
        image_original_url: asset.image,
        sell_orders: [],
        top_bid: {},
        animation_url: url ?? null,
        animation_original_url: url ?? null,
        name: asset.name ?? "",
        description: asset.description ?? null,
        external_link: asset.external_url ?? null,
        permalink:
            asset.external_url ||
            (asset.mint != null
                ? `https://explorer.solana.com/address/${asset.mint}`
                : null),
        asset_contract: { address: asset.mint ?? null },
        token_id: asset.name + `@${asset.mint}`,
        owner: {
            address: ownerId || asset.owners?.[0].owner || "",
            user: { profile_img_url: "/images/avatar.png" },
        },
        creator: {
            address: asset.properties?.creators?.[0]?.address ?? "",
            user: { profile_img_url: "/images/avatar.png" },
        },
        collection: {
            name: asset.collection?.name ?? "",
            image_url: asset.collection?.image_url || "",
            external_url: asset.collection?.external_url || "",
        },
        isOwned: true,
        blockchain: "solana",
        account_base_url: "https://explorer.solana.com/address",
        mime_type: mime,
        supply: asset.amount,
        needsRefetch: asset.needsRefetch,
    };
    return payload;
}

export async function isOwnerOfSolanaNft(
    wallet: string,
    {
        slug,
        address,
        verified,
    }: { slug?: string; address?: string; verified?: boolean }
): Promise<Result<boolean>> {
    try {
        //
        const connection = new Connection(nodeEnv.SOLANA_NETWORK, "confirmed");

        const accounts = await TokenAccount.getTokenAccountsByOwner(
            connection,
            wallet
        );

        const nftAccounts = accounts.filter(
            (acc) => acc.data?.amount?.toNumber() === 1
        );

        let ms = await getAssetsMetadata(
            connection,
            nftAccounts.map((acc) => acc.data.mint)
        );

        if (verified) {
            //
            const hasMatch = ms.some((m) => {
                return m.collection?.verified && m.collection?.key === address;
            });

            return Success(hasMatch);
        } else {
            const nonVerifiedMs = ms.filter((m) => {
                return (
                    m.collection == null &&
                    m.updateAuthority === address &&
                    m.data.uri
                );
            });

            const offchainData = nonVerifiedMs.map((m) => {
                return getJSON(m.data.uri).catch(() => null);
            });

            const match = await firstMatch(
                offchainData,
                (data) => data?.collection?.name === slug
            );

            if (match !== null) return Success(true);
        }

        return Success(false);
    } catch (error) {
        return Failure(
            error.message || "Failed to get ownership info for solana wallet"
        );
    }
}

function getCollectionFromMintAddress(
    address: string,
    verified: boolean
): Promise<Result<CollectionData>> {
    return fetchSolanaAssetById("", address).then((r) => {
        if (r.success) {
            return Success({
                slug: r.asset.name,
                name: r.asset.name,
                image: r.asset.image_preview_url || r.asset.image_url,
                address,
                verified,
                blockchain: "solana",
            });
        } else {
            return Failure(r.error || "Failed to fetch collection data");
        }
    });
}

export async function fetchSolanaUserCollections(
    owner: string
): Promise<Result<CollectionData[]>> {
    //
    try {
        const connection = new Connection(nodeEnv.SOLANA_NETWORK, "confirmed");

        const accounts = await TokenAccount.getTokenAccountsByOwner(
            connection,
            owner
        );

        const nftAccounts = accounts.filter(
            (acc) => acc.data?.amount?.toNumber() === 1
        );

        let ms = await getAssetsMetadata(
            connection,
            nftAccounts.map((acc) => acc.data.mint)
        );

        let collections: Record<string, CollectionData> = {};

        ms.forEach((m) => {
            const collectionAddress = m.collection?.key;
            if (
                collectionAddress &&
                m.collection.verified &&
                collections[collectionAddress] == null
            ) {
                collections[collectionAddress] = null;
            }
        });

        await Promise.all(
            Object.keys(collections).map((address) => {
                return getCollectionFromMintAddress(address, true).then((r) => {
                    if (r.success === true) {
                        collections[address] = r.value;
                    }
                });
            })
        );

        return Success(Object.values(collections));
    } catch (err) {
        console.error(err);
        return Failure(err?.message || "Failed to get solana user collections");
    }
}

export async function fetchSolanaCollection(
    mint: string
): Promise<Result<CollectionData[]>> {
    //
    if (!isSolanaAddress(mint)) {
        return Failure("Invalid solana mint address");
    }

    try {
        const connection = new Connection(nodeEnv.SOLANA_NETWORK, "confirmed");

        const ms = await getAssetsMetadata(connection, [mint]);

        if (ms?.length) {
            const m = ms[0];

            console.log("metadata", m);

            if (m.collection?.key && m.collection.verified) {
                const result = await getCollectionFromMintAddress(
                    m.collection.key,
                    true
                );

                if (result.success === true) {
                    return Success([result.value]);
                } else {
                    return result;
                }
            }
            if (m.data.uri) {
                try {
                    const data = await getJSON(m.data.uri);

                    if (data.collection?.name) {
                        return Success([
                            {
                                slug: data.collection.name,
                                name: data.collection.name,
                                // image: ,
                                address: m.updateAuthority,
                                verified: false,
                                blockchain: "solana",
                            },
                        ]);
                    } else {
                        return Failure(
                            "No collection info was found on this asset"
                        );
                    }
                } catch (error) {
                    return Failure(error.message);
                }
            } else {
                return Failure("No collection info was found on this asset");
            }
        } else {
            return Failure("Failed to fetch solana collection");
        }
    } catch (err) {
        return Failure(err.message || "Failed to fetch Solana collection");
    }
}
