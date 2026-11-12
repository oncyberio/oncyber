import React, { useRef } from "react";
import {
    UPDATE_CURRENT_DESTINATION,
    UserContext,
    USER_LOGIN,
} from "@components/context/UserContext";
import {
    checkServerError,
    fetchMarketplaceRooms,
    getCyberRoomContractAddresses,
    getOwnedRooms,
    preprocessDestination,
} from "@dapp/cyberRooms";
import {
    ReservoirChain,
    ReservoirMarketplace,
} from "@dapp/ReservoirMarketplace";
import { nodeEnv } from "@env";
import { useContext, useEffect, useState } from "react";
import { Destination } from "@uitypes/destinations";
import { useEventCallback } from "@components/hooks/useEventCallback";
import {
    cancelReview,
    deleteDestination,
    getDestination,
    getUserDestinations,
} from "@utils/saveToDb";
import DestinationService from "@api/destinations/_api";
import { amplitude_logAnalyticsEvent, getCookie } from "@utils/analytics";
import { createNewSpace } from "../../utils";
import { Experience } from "@uitypes/experience";
import { deferred, delay } from "@utils/js";
import { useRouter } from "next/router";
import { getProxyWallets } from "@utils/auth/proxyWallets";
import { showError } from "@components/Dialogs";
import {
    getLinkedWallets,
    getLinkedWalletsUserProxyObject,
    isEthAddressOrEthAddressLinked,
} from "@features/studio/utils";
import { canUseTemplate, withDefaultTemplateTags } from "./roomSections";
import { GALAXY_ROOM } from "@utils/emptyRoom";
interface RoomsState {
    buyingRoom: string;
    roomCreatingSpace: string;
}

export interface RoomsContextState {
    //
    context: RoomsProviderProps["context"];
    rooms: Destination[];
    ownedRooms: Record<string, boolean>;

    roomFloorPrices: Record<
        ReservoirChain,
        Record<string, Record<string, number>>
    >;
    isLoadingRooms: boolean;
    isCheckingBalances: boolean;
    loadingError: string;
    isLoadinUploads: boolean;

    loadPromise: Promise<unknown>;

    refetchRooms: () => Promise<unknown>;

    onRoomBuy: (slug: string) => unknown;
    deleteRoom: (id: string) => unknown;
    updateRoom: (room: string | Destination) => Promise<void>;
    handleCreateSpace: (room: Destination) => Promise<boolean>;
    onCreateSpace: (exhibit: Experience) => unknown;
    onCreateEmptyStudioSpace?: (kit?: string) => unknown;
    //
    roomsState: RoomsState;
    setRoomsState: React.Dispatch<React.SetStateAction<RoomsState>>;
}

const RoomsContext = React.createContext<RoomsContextState>(null);

const filterTags = {
    free: true,
    factory: true,
    curated: true,
    andfriends: true,
    collectibles: true,
    "oncyber-ethereum-community": true,
    uploaded: true,
};

interface RoomsProviderProps {
    rooms?: Destination[];
    context:
        | "uploader"
        | "marketplace"
        | "studio"
        | "world-builder"
        | "template";
    onCreateSpace?: (exhibit: Experience) => unknown;
    onCreateEmptyStudioSpace?: (kit?: string) => unknown;
    children?: React.ReactNode;
}

export function RoomsProvider({
    rooms: _rooms = [],
    children,
    context,
    onCreateSpace,
    onCreateEmptyStudioSpace,
}: RoomsProviderProps) {
    //
    const router = useRouter();

    const { user, token, dispatch, userData, defaultWallet, isAnonymous } =
        useContext(UserContext);

    const [isLoadingRooms, setLoadingRooms] = useState(
        context === "template" && _rooms.length === 0
    );

    const [isLoadinUploads, setLoadingUploads] = useState(true);

    const [rooms, setRooms] = useState<Destination[]>(_rooms);

    const [roomsState, setRoomsState] = useState<RoomsState>({
        buyingRoom: router.query?.buy as string,
        roomCreatingSpace: null,
    });

    const [roomFloorPrices, setRoomFloorPrices] = useState<
        Record<ReservoirChain, Record<string, Record<string, number>>>
    >({
        ethereum: {},
        polygon: {},
    });

    const loadRef = useRef(deferred());

    const [ownedRooms, setOwnedRooms] = useState<Record<string, boolean>>({});

    const [isCheckingBalances, setCheckingBalances] = useState(false);

    const [loadingError, setLoadingError] = useState<string>(null);

    useEffect(() => {
        if (context === "uploader" || context === "world-builder") return;

        async function fetchChainFloorPrices(
            contracts: string[],
            chain: ReservoirChain
        ) {
            //
            const addresses = getCyberRoomContractAddresses(contracts);

            let mp = ReservoirMarketplace.getInstance(chain);

            addresses.forEach(async (addr, i) => {
                //
                if (addr == null) return;

                const res = await mp.getCollectionFloorPrices(addr);

                if (res.success === true) {
                    setRoomFloorPrices((state) => ({
                        ...state,
                        [chain]: {
                            ...state[chain],
                            [contracts[i]]: res.value,
                        },
                    }));
                }
            });
        }

        async function fetchFloorPrices() {
            //
            const ethContracts = [
                "factory",
                "curated",
                "andfriends",
                "rtfkt",
                "oncyber-ethereum-community",
                "exopods",
            ];

            const polygonContracts = ["factory-polygon"];

            fetchChainFloorPrices(ethContracts, "ethereum");
            fetchChainFloorPrices(polygonContracts, "polygon");
        }

        fetchFloorPrices();
    }, []);

    const ssr = useRef(context === "marketplace");

    const ownershipGeneration = useRef(0);
    const ownershipIdentity = useRef("");
    const fetchAllRooms = async (opts: Record<string, any> = {}) => {
        const generation = ++ownershipGeneration.current;
        const current = () => generation === ownershipGeneration.current;
        setLoadingError(null);
        const identity = JSON.stringify([
            user?.id,
            token,
            defaultWallet,
            getLinkedWallets(userData, "ethereum"),
        ]);
        if (ownershipIdentity.current !== identity) {
            ownershipIdentity.current = identity;
            setOwnedRooms({});
        }
        setCheckingBalances(true);
        try {
            const forcedOwnershipWallet = nodeEnv.DEV_FORCED_OWNERSHIP_WALLET;

            let shouldCheckBalances =
                forcedOwnershipWallet != null ||
                isEthAddressOrEthAddressLinked(userData);

            let checkRooms: Destination[] = [];

            const defaultUserId = defaultWallet;

            const linkedWallets = getLinkedWallets(userData, "ethereum");

            let userWalletsObject = getLinkedWalletsUserProxyObject(userData);

            // fetch early, do not wait to not block the loading state
            let proxyWalletsPromise = shouldCheckBalances
                ? forcedOwnershipWallet == null
                    ? getProxyWallets(userWalletsObject)
                    : Promise.resolve({})
                : null;

            try {
                let fetchedRooms: Destination[] = _rooms;

                if (!(ssr.current && _rooms?.length)) {
                    if (rooms.length == 0) {
                        setLoadingRooms(true);
                    }

                    fetchedRooms = await fetchMarketplaceRooms(
                        user?.id,
                        token,
                        opts
                    );
                    //In case we change fetchMarketplaceRooms to fetch only owned rooms
                    // await Promise.all(Object.entries(proxyWallets).map(([index,walletData]) => fetchMarketplaceRooms(walletData?.walletId,token).then(x=>{fetchedRooms=fetchedRooms.concat(x)})))
                }

                fetchedRooms = fetchedRooms.map(withDefaultTemplateTags);

                fetchedRooms.forEach((it) => {
                    //

                    if (
                        shouldCheckBalances &&
                        !it.tag.includes("uploaded") &&
                        !it.tag.includes("free")
                    ) {
                        //
                        checkRooms.push(it);
                    }

                    //}
                });

                if (!current()) return;
                // An unchanged background refresh must not remount the card renderer.
                setRooms((previous) =>
                    JSON.stringify(previous) === JSON.stringify(fetchedRooms)
                        ? previous
                        : fetchedRooms
                );

                //
            } finally {
                //
                if (current()) setLoadingRooms(false);
            }

            if (shouldCheckBalances && checkRooms.length) {
                //
                setCheckingBalances(true);

                let proxyWallets = await proxyWalletsPromise.catch((_) => ({}));

                const allWallets = forcedOwnershipWallet
                    ? [forcedOwnershipWallet]
                    : Array.from(
                          new Set(
                              Object.values(proxyWallets)
                                  .map((walletData) => walletData?.walletId)
                                  .filter((id) => !!id)
                                  .concat(defaultUserId || [])
                                  .concat(linkedWallets)
                          )
                      );

                let _ownedRooms = {};

                // We should wait for all results before clearing the isCheckingBalances flag
                await Promise.all(
                    //
                    Object.values(allWallets).map(async (walletId) => {
                        //
                        const result = await getOwnedRooms(
                            walletId,
                            checkRooms
                        );

                        _ownedRooms = { ..._ownedRooms, ...result };
                    })
                );

                if (current())
                    setOwnedRooms((previous) =>
                        Object.keys(previous).length ===
                            Object.keys(_ownedRooms).length &&
                        Object.keys(previous).every(
                            (key) => previous[key] === _ownedRooms[key]
                        )
                            ? previous
                            : _ownedRooms
                    );
            }

            // if (tab != activeTab) return;
        } catch (err) {
            console.error(err);
            if (current())
                setLoadingError("Couldn’t check templates or ownership.");
        } finally {
            if (current()) setCheckingBalances(false);
        }
    };

    const uploadGeneration = useRef(0);
    const uploadIdentity = useRef("");
    useEffect(
        () => () => {
            uploadGeneration.current += 1;
        },
        []
    );
    const fetchUserRooms = async () => {
        const generation = ++uploadGeneration.current;
        const current = () => generation === uploadGeneration.current;
        const identity = JSON.stringify([user?.id, token]);
        if (uploadIdentity.current !== identity) {
            uploadIdentity.current = identity;
            setRooms([]);
        }
        setLoadingError(null);
        try {
            if (!user?.id || !token || isAnonymous) {
                setRooms([]);
                return;
            }
            setLoadingUploads(true);
            const response = await getUserDestinations(token, user.id);
            if (!current()) return;
            checkServerError(response);
            // The uploader still consumes the legacy gallery model, whose
            // optional fields are broader than the Firestore API declaration.
            const destinations = (response.data ||
                []) as unknown as Destination[];
            const uploadedRooms = destinations
                .filter((room) => room.chain !== "rinkeby")
                .map((room) => preprocessDestination(room, user.id));
            // The uploader endpoint is the complete account collection. Replace
            // it on refresh so deleted rooms and previous accounts cannot linger.
            setRooms((previous) =>
                JSON.stringify(previous) === JSON.stringify(uploadedRooms)
                    ? previous
                    : uploadedRooms
            );
        } catch (err) {
            console.error(err);
            if (current())
                setLoadingError(
                    "Couldn’t load your destinations. Please try again."
                );
        } finally {
            if (current()) setLoadingUploads(false);
        }
    };

    const fetchRooms = useEventCallback(async () => {
        //
        console.log("RoomsProvider fetchRooms", context);

        try {
            if (context === "marketplace" || context === "studio") {
                await fetchAllRooms({ isFuture: false });
            } else if (context === "template") {
                await fetchAllRooms({ isFuture: false });
            } else if (context === "world-builder") {
                await fetchAllRooms({ isFuture: true });
            } else {
                await fetchUserRooms();
            }
        } finally {
            loadRef.current.resolve(null);
        }

        ssr.current = false;
    }, []);

    useEffect(() => {
        //
        fetchRooms();
        //
    }, [user?.id, userData, defaultWallet, token, isAnonymous]);

    const deleteRoom = useEventCallback(async (id: string) => {
        //

        const response = await deleteDestination(id, token);

        checkServerError(response);

        setRooms((state) => {
            return state.filter((it) => it._id !== id);
        });
    }, []);

    const updateRoom = useEventCallback(async (room: string | Destination) => {
        //
        let destination: Destination;

        if (typeof room === "string") {
            destination = await DestinationService.getDestinationBySlug({
                slug: room,
            });
        } else {
            destination = room;
        }

        destination = preprocessDestination(destination, user?.id);

        setRooms((state) => {
            let newState = state.slice();

            let index = newState.findIndex((it) => it._id === destination._id);

            if (index < 0) {
                newState = [destination].concat(newState);
            } else {
                newState[index] = destination;
            }

            return newState;
        });
    }, []);

    const handleCreateSpace = async (room: Destination) => {
        //

        if (roomsState.roomCreatingSpace != null) return false;
        if (!canUseTemplate(room, ownedRooms, isCheckingBalances)) {
            showError(
                isCheckingBalances
                    ? "Wait for ownership verification to finish."
                    : "Connect the wallet that owns this gallery to use it."
            );
            return false;
        }

        try {
            setRoomsState((s) => {
                return { ...s, roomCreatingSpace: room.slug };
            });

            amplitude_logAnalyticsEvent("create_gallery", {
                room: room.slug,
                user_id: user?.id,
                source: getCookie("source.ExhibitSelectorMenu"),
            });

            const exhibit = await createNewSpace(user?.id, token, room.slug);

            await onCreateSpace?.(exhibit);

            return true;
            //
        } catch (err) {
            console.error(err);
            showError(err.message || "Failed to login");
            return false;
        } finally {
            setRoomsState((s) => {
                return { ...s, roomCreatingSpace: null };
            });
        }
    };

    const onRoomBuy = (slug: string) => {
        setOwnedRooms((state) => {
            return {
                ...state,
                [slug]: true,
            };
        });
    };

    const value: RoomsContextState = {
        context,
        rooms,
        ownedRooms,
        roomFloorPrices,
        isLoadingRooms,
        isCheckingBalances,
        loadingError,
        isLoadinUploads,

        onCreateEmptyStudioSpace,

        refetchRooms: fetchRooms,

        deleteRoom,
        updateRoom,
        handleCreateSpace,
        onRoomBuy,

        onCreateSpace,

        loadPromise: loadRef.current.promise,

        roomsState,
        setRoomsState,
    };

    return (
        <RoomsContext.Provider value={value}>{children}</RoomsContext.Provider>
    );
}

export function useRooms() {
    return useContext(RoomsContext);
}
