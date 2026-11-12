import { BigNumber, ethers } from "ethers";
import { nodeEnv } from "env";
import { isOwnerOfEtherumNft } from "@utils/ethereumAssets";
import {
    isEthereumAddress,
    isSolanaAddress,
    isTezosAddress,
} from "@utils/getAddrType";
import { CollectionData } from "@uitypes/experience";
import { isOwnerOfTezosNft } from "@utils/tezosAssets";

import ABI_ERC165 from "config/ethereum/ERC165_abi.json";
import ABI_ERC721 from "config/ethereum/ERC721_abi.json";
import ABI_ERC1155 from "config/ethereum/ERC1155_abi.json";
import { Failure, Result, Success } from "@utils/js";
import { isOwnerOfSolanaNft } from "@utils/solanaAssets";

const ERC1155InterfaceId = "0xd9b67a26";
const ERC721InterfaceId = "0x80ac58cd";

async function isERC1155(provider, contractAddress) {
    //
    const contract = new ethers.Contract(contractAddress, ABI_ERC165, provider);

    const result = await contract.supportsInterface(ERC1155InterfaceId);

    return result;
}

async function isERC721(provider, contractAddress) {
    //
    const contract = new ethers.Contract(contractAddress, ABI_ERC165, provider);

    const result = await contract.supportsInterface(ERC721InterfaceId);

    return result;
}

async function ETH_isCollectionOwner(
    walletId: string,
    { slug, address, type, blockchain }: CollectionData
): Promise<Result<boolean>> {
    //
    if (!isEthereumAddress(walletId)) return Success(false);

    if (address == null) {
        return isOwnerOfEtherumNft(walletId, { slug, blockchain });
    }

    const provider = new ethers.providers.JsonRpcProvider(
        blockchain === "base" ? nodeEnv.BASE_RPC : nodeEnv.ETH_RPC
    );

    // Normally we should always have this info when we setup the nft gating
    if (type == null) {
        const is721 = await isERC721(provider, address);
        type = is721 ? "ERC721" : "ERC1155";
    }

    if (type === "ERC721") {
        //
        const contract = new ethers.Contract(address, ABI_ERC721, provider);

        let balance = await contract.balanceOf(walletId);

        balance = balance.toNumber();

        return Success(balance > 0);
        //
    } else if (type === "ERC1155") {
        //
        const contract = new ethers.Contract(address, ABI_ERC1155, provider);

        const filter = contract.filters.TransferSingle(null, null, walletId);

        let ids = [];

        let ts = await contract.queryFilter(filter);

        ts.forEach((t) => {
            ids.push(t.args.id);
        });

        let addresses = new Array(ids.length).fill(walletId);

        let balances: BigNumber[] = await contract.balanceOfBatch(
            addresses,
            ids
        );

        for (let i = 0; i < balances.length; i++) {
            const b = balances[i];
            if (b.gt(0)) {
                return Success(true);
            }
        }

        return Success(false);
    }
}

async function TEZOS_isCollectionOwner(
    walletId: string,
    { address, slug }: CollectionData
): Promise<Result<boolean>> {
    //
    if (!isTezosAddress(walletId)) return Success(false);

    // TODO: investigate usage of direct contract calls (fa/fa2 ... standard)
    // for now we use the indexer
    return isOwnerOfTezosNft(walletId, {
        slug,
        address,
    });
}

async function SOLANA_isCollectionOwner(
    walletId: string,
    collection: CollectionData
): Promise<Result<boolean>> {
    //
    if (!isSolanaAddress(walletId)) return Success(false);

    return isOwnerOfSolanaNft(walletId, collection);
}

export async function isCollectionOwner(
    walletId: string,
    collection: CollectionData
): Promise<Result<boolean>> {
    //

    const { blockchain } = collection;

    try {
        if (blockchain === "ethereum" || blockchain === "base") {
            return ETH_isCollectionOwner(walletId, collection);
        } else if (blockchain === "tezos") {
            return TEZOS_isCollectionOwner(walletId, collection);
        } else if (blockchain === "solana") {
            return SOLANA_isCollectionOwner(walletId, collection);
        } else {
            return Failure("Invalid blockchain param " + blockchain);
        }
    } catch (err) {
        console.error(err);
        return Failure(err.message || "Unexpected error");
    }
}
