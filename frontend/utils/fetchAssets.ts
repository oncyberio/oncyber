import { Blockchain } from "@dapp/connect";
import { CollectionData, Experience } from "@uitypes/experience";

import { fetchAutographAssetById } from "./autographAssets";
import {
    fetchCounterPartyAssetById,
    fetchCounterpartyCollections,
    fetchCounterpartyUserCollections,
    fetchCreatedCounterpartyAssets,
    fetchOwnedCounterpartyAssets,
    isOwnerOfCounterpartyNft,
} from "./counterpartyAssets";
import {
    fetchCreatedEthereumAssets,
    fetchEthereumAssetById,
    fetchEthereumCollection,
    fetchEthereumUserCollections,
    fetchOwnedEthereumAssets,
    isOwnerOfEtherumNft,
} from "./ethereumAssets";
import { getAddrType } from "./getAddrType";
import { delay, Failure, Result, Success } from "./js";
import {
    fetchCreatedNftPortAssets,
    fetchNftPortAssetById,
} from "./nftPortAssets";
import { fetchCreatedNiftyAssets, fetchOwnedNiftyAssets } from "./niftyAssets";
import { fetchChainAssetById } from "./polygonAssets";
import {
    fetchCreatedTezosAssets,
    fetchOwnedTezosAssets,
    fetchTezosAssetById,
    fetchTezosCollection,
    fetchTezosUserCollections,
    isOwnerOfTezosNft,
} from "./tezosAssets";

import { fetchOwnedChainAssets } from "./polygonAssets";

export async function fetchCreatedAssets(
    creatorId: string,
    marketplace?: string,
    page?: number
) {
    const blockchain = getAddrType(creatorId);
    switch (blockchain) {
        case "ethereum":
            if (marketplace === "nftport") {
                return fetchCreatedNftPortAssets(creatorId);
            }
            return fetchCreatedEthereumAssets(creatorId);
        case "tezos":
            return fetchCreatedTezosAssets(creatorId);
        case "niftygateway":
            return fetchCreatedNiftyAssets(creatorId);
        case "solana":
            throw new Error("Unavailable at the moment");
        // return fetchCreatedSolanaAssets(creatorId);
        case "counterparty":
            return fetchCreatedCounterpartyAssets(creatorId, page);
        default:
            throw new Error("Unkown blockchain " + blockchain);
    }
}

export async function fetchOwnedAssets(ownerId: string, page: any) {
    const blockchain = getAddrType(ownerId);
    switch (blockchain) {
        case "ethereum":
            return fetchOwnedEthereumAssets(
                ownerId,
                typeof page === "string" ? page : undefined
            );
        case "tezos":
            return fetchOwnedTezosAssets(ownerId, page);
        case "niftygateway":
            return fetchOwnedNiftyAssets(ownerId, page);
        case "solana":
            return fetchOwnedChainAssets("solana", ownerId, page);
        // return fetchOwnedSolanaAssets(ownerId, page);
        case "counterparty":
            return fetchOwnedCounterpartyAssets(ownerId, page);
        default:
            throw new Error("Unkown blockchain " + blockchain);
    }
}

export async function fetchAssetById(
    walletId: string,
    address: string,
    tokenId: string,
    marketplace?: string,
    customData?: any
) {

    const blockchain = getAddrType(walletId);
    switch (blockchain) {
        case "ethereum":
            if (marketplace === "matic" || marketplace === "klaytn")
                return fetchChainAssetById(
                    marketplace,
                    walletId,
                    address,
                    tokenId
                );
            else if (marketplace === "autograph") {
                return fetchAutographAssetById(
                    walletId,
                    address,
                    tokenId,
                    customData
                );
            } else if (marketplace === "nftport") {
                return fetchNftPortAssetById(walletId, address, tokenId);
            }
            return fetchEthereumAssetById(address, tokenId);
        case "solana": {
            if (marketplace === "opensea")
                return fetchChainAssetById(
                    "solana",
                    walletId,
                    address,
                    tokenId
                );
            const { fetchSolanaAssetById } = await import("./solanaAssets");
            return fetchSolanaAssetById(walletId, address);
        }
        case "tezos":
            return fetchTezosAssetById(walletId, address, tokenId);
        case "counterparty":
            return fetchCounterPartyAssetById(tokenId);
        default:
            throw new Error("No refetch support for blockchain " + blockchain);
    }
}

export async function isOwnerOfNftCollection(
    userAddress: string,
    filter: {
        slug?: string;
        address?: string;
        blockchain: CollectionData["blockchain"];
    }
) {
    const userBlockchain = getAddrType(userAddress);
    if (userBlockchain !== filter.blockchain) {
        return Success(false);
    }
    switch (filter.blockchain) {
        case "ethereum":
            return isOwnerOfEtherumNft(userAddress, filter);
        case "tezos":
            return isOwnerOfTezosNft(userAddress, filter);
        // case "solana":
        // return isOwnerOfSolanaNft(userAddress, filter);
        case "counterparty":
            return isOwnerOfCounterpartyNft(userAddress, filter);
        default:
            return Failure(
                "No ownership check support for blockchain " + filter.blockchain
            );
    }
}

export async function fetchCollections(
    collection: string,
    blockchain: Blockchain
): Promise<Result<CollectionData[]>> {
    switch (blockchain) {
        case "ethereum":
            return fetchEthereumCollection(collection);
        case "tezos":
            return fetchTezosCollection(collection);
        case "counterparty":
            return fetchCounterpartyCollections(collection);
        // case "solana":
        //     return fetchSolanaCollection(collection);
        default:
            return Failure(
                "fetchCollections is not supported for blockchain " + blockchain
            );
    }
}

export async function fetchUserCollections(
    wallet: string
): Promise<Result<CollectionData[]>> {
    //
    const blockchain = getAddrType(wallet);

    switch (blockchain) {
        case "ethereum":
            return fetchEthereumUserCollections(wallet);
        case "tezos":
            return fetchTezosUserCollections(wallet);
        case "counterparty":
            return fetchCounterpartyUserCollections(wallet);
        // case "solana":
        //     return fetchSolanaUserCollections(wallet);

        default:
            return Failure(
                "No ownership check support for blockchain " + blockchain
            );
    }
}
