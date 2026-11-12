import { cachedDestinationCatalog } from "@utils/destinationCatalogCache";
import { nodeEnv } from "@env";
import DestinationServiceClient from "@api/destinations/_api";
import config from "config";
import { BigNumber, ethers, utils } from "ethers";
import maticFactoryContract from "config/mainnet/DiamondCyberDestinationUtilityFactory.json";
import { RoomParameters } from "@uitypes/roomParameters";
import { getBalance } from "./explorer";
import { Destination } from "@uitypes/destinations";
import { FetchedAsset } from "@uitypes/Asset";

const cyberContracts = [
    "factory",
    "curated",
    "rtfkt",
    "andfriends",
    "factory-polygon",
    "autograph",
    "oncyber-ethereum-community",
    "collectibles",
    "exopods",
];

export type CyberContract = typeof cyberContracts[number];

export interface Contract {
    address: string;
    abi: any;
}

export async function getBatchBalance(
    provider: ethers.providers.Provider,
    { address, abi }: Contract,
    owner: string,
    tokenIds: number[]
) {
    //
    const contract = new ethers.Contract(address, abi, provider);

    const addresses = new Array(tokenIds.length).fill(owner);

    const balances: BigNumber[] = await contract.balanceOfBatch(
        addresses,
        tokenIds
    );

    return balances.map((bn) => bn.toNumber());
}

export async function checkCollectibleOwnership(owner, destinations) {
    const balances = new Array(destinations.length);

    await Promise.all(
        destinations.map(async ({ collection }, index) => {
            const balance = await getBalance(owner, collection, collection);

            if (typeof balance === "number") {
                balances[index] = balance;
            }
        })
    );

    return balances;
}

const ETH_MAINNET = 1;
const ETH_MAINNET_NETWORK = { chainId: 1, name: "homestead" } as const;
const POLYGON_MAINNET_NETWORK = { chainId: 137, name: "matic" } as const;

async function detectMetamaskEth() {
    //
    if (typeof window === "undefined") return null;

    const eth = window.ethereum as any;

    if (eth == null || !eth.isMetaMask || !eth.isConnected?.()) return;

    // Fastest but deprecated
    let chainId = eth.chainId;

    if (chainId == null) {
        try {
            chainId = await eth.request({ method: "eth_chainId" });
        } catch (err) {
            console.error(err);
        }
    }

    if (chainId == ETH_MAINNET) return eth;

    return null;
}

async function detectUserProvider() {
    //
    return detectMetamaskEth();
}

export async function getRoomContractBalances(
    owner: string,
    contractName: string,
    tokenIds: number[],
    contractAddress?: string
) {
    if (contractName === "autograph") {
        const balance = await getAutographRoomBalance(owner);
        return [balance];
    }

    let provider: ethers.providers.Provider;
    let balanceContract: Contract;

    if (contractName === "factory-polygon") {
        provider = new ethers.providers.StaticJsonRpcProvider(
            nodeEnv.POLYGON_RPC,
            POLYGON_MAINNET_NETWORK
        );
        balanceContract = {
            address: contractAddress || maticFactoryContract.address,
            abi: maticFactoryContract.abi,
        };
    } else {
        let eth = await detectUserProvider();
        if (eth != null) {
            console.log("detected user provider", eth);
            provider = new ethers.providers.Web3Provider(eth);
        } else {
            provider = new ethers.providers.StaticJsonRpcProvider(
                nodeEnv.ETH_BALANCE_CHECKER_RPC,
                ETH_MAINNET_NETWORK
            );
        }
        const abi = config[contractName]?.json?.abi;
        const address =
            contractAddress ||
            config[contractName]?.json?.address ||
            config[contractName]?.mainnetAddress;

        if (abi == null || address == null) {
            throw new Error("Unknown room contract " + contractName);
        }

        balanceContract = {
            address,
            abi,
        };
    }

    return getBatchBalance(provider, balanceContract, owner, tokenIds);
}

export async function getAutographRoomBalance(owner: string) {
    //
    let response = await fetch(
        `https://api.autograph.io/v1/api/nfts/6206e621c19ea3000e496f3f/public/count?address=${owner}`
    );

    // CF https://linear.app/oncyber/issue/PROD-1395/3d-studio-add-asset-user-cant-add-any-of-his-autograph-nft-to-the
    // Autogrpah user id could be using the checksumed eth address
    if (!response.ok) {
        const checksumAddr = utils.getAddress(owner);

        response = await fetch(
            `https://api.autograph.io/v1/api/nfts/6206e621c19ea3000e496f3f/public/count?address=${checksumAddr}`
        );
    }

    const data = await response.json();

    return isNaN(+data) ? 0 : +data;
}

export async function getOwnedRooms(
    owner: string,
    destinations: Destination[]
) {
    //
    let destinationsByContractKey: Record<
        string,
        {
            contractName: string;
            contractAddress?: string;
            destinations: Destination[];
        }
    > = {};

    let ownedRooms: Record<string, boolean> = {};

    // 1- Group rooms by contract
    destinations.forEach((it) => {
        //
        if (
            !it.nonFungible ||
            !it.contractName ||
            // this thing can be 0 so !it.token_id won't work
            it.token_id == null ||
            !cyberContracts.includes(it.contractName)
        )
            return;

        const contractName = it.contractName;
        const contractAddress = it.contract_address?.toLowerCase();
        const contractKey = `${contractName}:${contractAddress || ""}`;

        let roomGroup = destinationsByContractKey[contractKey];

        if (roomGroup == null) {
            roomGroup = destinationsByContractKey[contractKey] = {
                contractName,
                contractAddress,
                destinations: [],
            };
        }

        roomGroup.destinations.push(it);
    });

    // 2- For each contract call batch balance on all rooms in that contract
    await Promise.all(
        Object.values(destinationsByContractKey).map(
            async ({ contractName, contractAddress, destinations }) => {
                //

                const tokenIds = destinations.map((it) => +it.token_id);

                try {
                    let balances = [];

                    if (contractName === "collectibles") {
                        balances = await checkCollectibleOwnership(
                            owner,
                            destinations
                        );
                    } else {
                        balances = await getRoomContractBalances(
                            owner,
                            contractName,
                            tokenIds,
                            contractAddress
                        );
                    }

                    balances?.forEach((it, index) => {
                        if (it > 0) {
                            const slug = destinations[index].slug;
                            ownedRooms[slug] = true;
                        }
                    });
                } catch (err) {
                    console.error(err);
                }
            }
        )
    );

    return ownedRooms;
}

const buyableContracts = [
    "factory",
    "curated",
    "rtfkt",
    "andfriends",
    "factory-polygon",
    "oncyber-ethereum-community",
    "exopods",
];

export function canBuyRoom(room: Destination) {
    return room.nonFungible && buyableContracts.includes(room.contractName);
}

export function getRoomExternalLink(room: Destination) {
    if (room.contractName === "autograph") {
        return `https://autograph.io/details/6206e621c19ea3000e496f3f/nft`;
    }

    if (room.contractName === "collectibles") {
        return room.openseaLink;
    } else if (room.contract_address != null && room.token_id != null) {
        // polygon rooms store their contract address with an "m" prefix
        // (see assetFromRoom) — strip it or the OpenSea url 404s
        const contractAddress = room.contract_address.startsWith("m")
            ? room.contract_address.slice(1)
            : room.contract_address;

        if (room.blockchain === "polygon") {
            return `https://opensea.io/assets/matic/${contractAddress}/${room.token_id}`;
        } else if (room.blockchain === "ethereum") {
            return `https://opensea.io/assets/ethereum/${contractAddress}/${room.token_id}`;
        }
    }
}

const addressesMap = {
    factory: "0x226Bf5293692610692E2C996C9875C914d2A7f73",
    curated: "0xC86Ca2BB9C9c9c9F140d832dE00BfA9e153FA1e3",
    rtfkt: "0xb7be4001bff2c5f4a61dd2435e4c9a19d8d12343",
    andfriends: "0xA642375Cc15249A81da9c435fB4eDD8A9343ce7F",
    "factory-polygon": "0x6EBA841F1201fFDDe7DDC2ba995D3308f6C4aEa0",
    "oncyber-ethereum-community": "0x449f661c53aE0611a24c2883a910A563A7e42489",
    exopods: "0x895554bc4f48fe1c2bf5c198bfa3513da538f86b",
};

export function getCyberRoomContractAddresses(contractNames: string[]) {
    return contractNames.map((cn) => {
        return addressesMap[cn];
    });
}

export function assetFromRoom(room: Destination): FetchedAsset {
    //
    const isMatic = room.contractName === "factory-polygon";

    let contract_address = room.contract_address?.startsWith("m")
        ? room.contract_address.slice(1)
        : room.contract_address;

    return {
        name: room.name,
        mime_type: "model/gltf-binary",
        contract_address,
        token_id: String(room.token_id),
        token_address: contract_address,
        owner: {
            username: room.author?.name,
            user: {
                username: room.author?.name,
            },
        },
        blockchain: "ethereum",
        image_url: room.image || room.thumbnail,
        image_preview_url: room.image || room.thumbnail,
        contract: {
            name: room.name,
        },
        collection: {
            name: room.collection,
        },
        marketplace: isMatic ? "matic" : "default",
        customData: { slug: room.slug },
    };
}

export function isPolygonRoom(room: Destination) {
    return (
        room.contractName === "factory-polygon" ||
        room.contractName === "oncyber-polygon-community"
    );
}

export function checkServerError(response, defaultMsg = "Unknown Error") {
    if (!response.success) {
        throw new Error(response.error || response.message || defaultMsg);
    }
}

export function preprocessDestination(
    destination: Destination,
    userId: string
) {
    //
    if (destination.contract_address?.startsWith("m")) {
        destination.contract_address = destination.contract_address.slice(1);
    }

    if (destination.contractName === "collectibles") {
        destination.blockchain = null;
    } else if (destination.nonFungible && !destination.blockchain) {
        if (isPolygonRoom(destination)) {
            destination.blockchain = "polygon";
        } else {
            destination.blockchain = "ethereum";
        }
    }

    if (destination?.author?.userId === userId) {
        destination.tag?.push?.("uploaded");
    }

    return destination;
}

// The active destinations catalog is the same for every user; fetching it
// over GET lets the CDN cache one copy instead of re-reading the whole
// active set from Firestore per page view (see /api/destinations/active).
// We key the request by a `v` version (bumped on publish) so the catalog can
// be cached for an hour yet still update immediately when it changes.
async function fetchActiveCatalog(): Promise<any[]> {
    let versionQuery = "";
    try {
        const vRes = await fetch("/api/destinations/active-version");
        const vJson = await vRes.json();
        if (vJson?.v) versionQuery = `?v=${vJson.v}`;
    } catch (err) {
        // version unavailable — fetch the unversioned URL (still cached)
        console.error("Failed to fetch active catalog version", err);
    }

    const response = await fetch(`/api/destinations/active${versionQuery}`);
    const json = await response.json();

    if (!json?.success) {
        throw new Error("Failed to fetch active destinations");
    }

    return json.destinations || [];
}

function createdAtSeconds(destination: any) {
    const t = destination?.created_at;
    return t?._seconds ?? t?.seconds ?? 0;
}

export async function fetchMarketplaceRooms(
    userId: string,
    token: string,
    opts: Record<string, any> = {}
) {
    //
    // During SSR neither the relative catalog fetch nor the cookie-based
    // authenticated RPC can succeed — they only produced error noise (the
    // old RPC path had the same limitation). Rooms load client-side from
    // the CDN-cached catalog.
    if (typeof window === "undefined") {
        return [];
    }

    let data;

    try {
        // The catalog is public and identical for everyone — serve it to
        // logged-out users too, instead of the old 50-doc tag query.
        // Logged-in users additionally get their own destinations merged in.
        // Replaces the getCreatedSpaces RPC, which re-read every active
        // destination per request.
        const [catalog, userDestinations] = await Promise.all([
            cachedDestinationCatalog(fetchActiveCatalog),
            token
                ? DestinationServiceClient.opts({ token })
                      .getUserDestinations({})
                      .catch((err) => {
                          console.error(
                              "Failed to fetch user destinations",
                              err
                          );
                          return [];
                      })
                : [],
        ]);

        const seen = new Set<string>();
        data = [];

        for (const it of [...catalog, ...(userDestinations || [])]) {
            if (!seen.has(it._id)) {
                seen.add(it._id);
                data.push(it);
            }
        }

        // Same isFuture semantics as the getCreatedSpaces RPC
        const isFuture = opts?.isFuture;
        if (isFuture === true || isFuture === "true") {
            data = data.filter((it) => it.params?.isFuture === true);
        } else if (isFuture === false || isFuture === "false") {
            data = data.filter(
                (it) =>
                    it.params?.isFuture === false || it.params?.isFuture == null
            );
        }

        data.sort((a, b) => createdAtSeconds(b) - createdAtSeconds(a));
    } catch (err) {
        // Catalog unavailable (e.g. during SSR where relative fetches don't
        // resolve) — fall back to the limited tag query
        console.error("Falling back to tag query for marketplace rooms", err);

        data = await DestinationServiceClient.getDestinationsByTag({
            tag: "active",
        });
    }

    let fetchedRooms: Destination[] = [];

    data?.forEach?.((it) => {
        //
        if (it.chain === "rinkeby") return;

        let destination = preprocessDestination(it, userId);

        fetchedRooms.push(destination);
    });

    return fetchedRooms;
}
