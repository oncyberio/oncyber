import { useOnClickOutside } from "@components/hooks/useClickOutside";
import Dropdown from "@ui/components/Dropdown";
import { CollectionData, Experience } from "@uitypes/experience";
import Spinner from "@ui/components/Spinner";
import { fetchCollections, fetchUserCollections } from "@utils/fetchAssets";
import { KeyboardEvent, useContext, useEffect, useState } from "react";
import styled from "styled-components";
import { useSpaceGatingEditor } from "../context/SpaceGatingContext";
import { Input } from "../shared/Input";
import { Footer } from "../styles/Footer";
import { Form, FormLabel } from "../styles/Form";
import { Header } from "../styles/Header";
import { UserContext } from "@components/context/UserContext";
import { removeDuplicates } from "@utils/js";
import { GatingUIProps } from "./types";
import { useGatingEditCancel } from "./useGatingEditCancel";
import { GatingCancelButton, GatingOkButton } from "./Buttons";
import { useFormHandler } from "../context/ActionsContext";
import { ComboBox } from "@features/studio/EditWorldMenu/AddAsset/shared/ComboBox";

type NftGating = Experience["gating"]["nftOwnership"];

type NftSource = NftGating[number]["blockchain"] | "mycollections";

interface NftOptions {
    title: string;
    disabled: boolean;
    value: NftSource;
}

const items: Array<NftOptions> = [
    {
        title: "My collections",
        disabled: false,
        value: "mycollections",
    },
    {
        title: "Ethereum",
        disabled: false,
        value: "ethereum",
    },
     {
        title: "Base",
        disabled: false,
        value: "base",
    },
    {
        title: "Tezos",
        disabled: false,
        value: "tezos",
    },
    // Keep disabled until we have authenticated counterparty users
    // {
    //     title: "Counterparty",
    //     disabled: false,
    //     value: "counterparty",
    // },

    // {
    //     title: "Solana",
    //     disabled: false,
    //     value: "solana",
    // },
];

interface CollectionInput {
    query: string;
    result?: CollectionData;
}

type CollectionResult =
    | { type: "Idle" }
    | { type: "Loading" }
    | { type: "LoadingSuccess"; data: CollectionData[] }
    | { type: "LoadingError"; error: string };

const OPENSEA_COLLECTION_URL_PREFIX = "https://opensea.io/collection/";

const OBJKT_COLLECTION_URL_PREFIX = "https://objkt.com/collection/";

const icons: Record<NftSource, string> = {
    ethereum: "/v2/icons/ethereum.svg",
    base: "/v2/icons/base.svg",
    tezos: "/v2/icons/tezos.svg",
    counterparty: "/v2/icons/counterparty.svg",
    mycollections: "",
    solana: "/v2/icons/solana.svg",
};

const labels: Record<NftSource, string> = {
    ethereum: "Enter opensea collection URL or slug",
    base: "Enter opensea collection URL or slug",
    tezos: "Enter objkt.com collection URL or contract",
    counterparty: "Search in offical xchain cards",
    mycollections: "Search in your NFT collections",
    solana: "Enter mint address",
};

function collectionsEq(c1: CollectionData, c2: CollectionData): boolean {
    if (c1.blockchain !== c2.blockchain) return false;

    if (c1.blockchain === "ethereum") {
        return c1.slug === c2.slug;
    } else {
        return c1.address === c2.address;
    }
}

const VERIFIED_ICON = "/v2/icons/check.svg";

export function SpaceGatingNfts({ initState, onClose }: GatingUIProps) {
    //
    const { accounts } = useContext(UserContext);

    const { gating, editGating } = useSpaceGatingEditor();

    const cancelGatingEdit = useGatingEditCancel(
        "nftOwnership",
        initState?.nftOwnership
    );

    const { clickRef } = useOnClickOutside({
        handler: (e) => {
            setCollectionResult({ type: "Idle" });
        },
    });

    const [nftSource, setNftSource] = useState<NftSource>("mycollections");

    const [collectionInput, setCollectionInput] = useState<CollectionInput>({
        query: "",
    });

    const [collectionResult, setCollectionResult] = useState<CollectionResult>({
        type: "Idle",
    });

    const [userCollections, setUserCollections] = useState<CollectionData[]>(
        []
    );

    const selectedCollections = gating.nftOwnership || [];

    useEffect(() => {
        Object.values(accounts).forEach(async (acc) => {
            try {
                const data = await fetchUserCollections(acc.walletId);
                if (data.success) {
                    setUserCollections((cs) =>
                        removeDuplicates(cs.concat(data.value), "name")
                    );
                }
            } catch (err) {
                console.error(err.message);
            }
        });
    }, []);

    useEffect(() => {
        if (collectionInput.result || !collectionInput?.query?.trim()) {
            setCollectionResult({ type: "Idle" });
            return;
        }

        let cancelled = false;

        let filter = collectionInput.query.trim().toLowerCase();

        if (nftSource === "mycollections") {
            let matches = userCollections.filter((it) => {
                return (
                    it.name?.toLowerCase().includes(filter) ||
                    it.slug?.toLowerCase().includes(filter) ||
                    it.address?.toLowerCase() === filter
                );
            });

            if (matches.length) {
                setCollectionResult({ type: "LoadingSuccess", data: matches });
            } else {
                setCollectionResult({ type: "Idle" });
            }

            return;
        }

        const tid = setTimeout(async () => {
            try {
                setCollectionResult({ type: "Loading" });

                let query = collectionInput.query.trim();


                let sourceChain = nftSource

                // preporcess opensea urls
                if (
                    (nftSource === "ethereum" || nftSource === "base") &&
                    query.startsWith(OPENSEA_COLLECTION_URL_PREFIX)
                ) {
                    sourceChain = "ethereum"
                    query = query.slice(OPENSEA_COLLECTION_URL_PREFIX.length);
                } else if (
                    nftSource === "tezos" &&
                    query.startsWith(OBJKT_COLLECTION_URL_PREFIX)
                ) {
                    query = query.slice(OBJKT_COLLECTION_URL_PREFIX.length);
                }

                // @ts-ignore
                const result = await fetchCollections(query, sourceChain);

                if (cancelled) return;

                if (result.success === true) {
                    setCollectionResult({
                        type: "LoadingSuccess",
                        data: result.value,
                    });
                } else {
                    setCollectionResult({
                        type: "LoadingError",
                        error: result.error,
                    });
                }
            } catch (err) {
                setCollectionResult({
                    type: "LoadingError",
                    error: err.message || "Failed to fetch collections",
                });
            } finally {
                if (cancelled) {
                    setCollectionResult({ type: "Idle" });
                }
            }
        }, 1000);

        return () => {
            cancelled = true;
            clearTimeout(tid);
        };
    }, [collectionInput, nftSource]);

    const handleAddCollection = (collection: CollectionData) => {
        console.log("add collection", collection);
        setCollectionInput({
            query: collection.slug,
            result: collection,
        });
        setCollectionResult({ type: "Idle" });

        if (!selectedCollections.some((it) => collectionsEq(it, collection))) {
            const nftOwnership = selectedCollections.concat(collection);

            editGating(
                {
                    nftOwnership,
                },
                "save"
            );
        }
    };

    const handleDeleteCollection = (collection: CollectionData) => {
        const nftOwnership = selectedCollections.filter((it) => {
            return !collectionsEq(it, collection);
        });

        editGating(
            {
                nftOwnership,
            },
            "save"
        );
    };

    const handleSearchKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        // console.log(e.key);
        if (e.key === "Escape") {
            setCollectionResult({ type: "Idle" });
        }
    };

    const label = labels[nftSource];

    let placeholder;

    if (nftSource === "ethereum") {
        placeholder = "example: cryptopunks";
    } else if (nftSource === "tezos") {
        placeholder = "examples: hicetnunc, KT1TAS2...";
    }
    if (nftSource === "counterparty") {
        placeholder = "example: rare pepe";
    } else {
        placeholder = "Type some keyword";
    }

    return (
        <Container>
            <Header>Access for specific NFT owners</Header>

            <Form style={{ marginTop: "32px" }}>
                <FormLabel>{label}</FormLabel>
                <Row>
                    <SearchWrapper ref={clickRef}>
                        <Input
                            style={{ marginTop: "8px", width: "100%" }}
                            placeholder={placeholder}
                            icon={
                                collectionResult.type === "Loading" ||
                                collectionResult.type === "LoadingError"
                            }
                            value={collectionInput.query}
                            onChange={(e) => {
                                setCollectionInput({ query: e.target.value });
                            }}
                            onKeyDown={handleSearchKeyDown}
                        >
                            {collectionResult.type === "Loading" ? (
                                <Spinner width={24} isLightTheme />
                            ) : collectionResult.type === "LoadingError" ? (
                                <span
                                    style={{
                                        display: "inlineBlock",
                                        height: "100%",
                                        fontSize: "1.2rem",
                                    }}
                                    title="Couldn't find anything"
                                >
                                    ⚠️
                                </span>
                            ) : null}
                        </Input>
                        {collectionResult.type === "LoadingSuccess" && (
                            <Autocomplete>
                                {collectionResult.data.map((collection) => {
                                    return (
                                        <AutocompleteItem
                                            tabIndex={-1}
                                            onClickCapture={() => {
                                                console.log(
                                                    "add the funcking collection",
                                                    collection
                                                );

                                                handleAddCollection(collection);
                                            }}
                                        >
                                            {collection.image && (
                                                <Icon
                                                    src={collection.image}
                                                    style={{
                                                        width: 20,
                                                        height: 20,
                                                    }}
                                                />
                                            )}
                                            {collection.name || collection.slug}
                                            {collection.verified && (
                                                <Icon
                                                    src={VERIFIED_ICON}
                                                    style={{
                                                        marginLeft: "5px",
                                                        marginTop: "2px",
                                                    }}
                                                    alt="This collection is verified"
                                                />
                                            )}
                                        </AutocompleteItem>
                                    );
                                })}
                            </Autocomplete>
                        )}
                    </SearchWrapper>
                    <ComboBox
                        style={{
                            width: "200px",
                        }}
                        overrideTheme="dark"
                        items={items}
                        value={nftSource}
                        onChange={(e) => setNftSource(e)}
                    />
                </Row>
            </Form>

            <NftsArea>
                {selectedCollections.map((collection, index) => {
                    return (
                        <NftBadge
                            key={index}
                            onClick={() => handleDeleteCollection(collection)}
                        >
                            <Icon src={icons[collection.blockchain]} />
                            {collection.name || collection.slug} ✖{" "}
                        </NftBadge>
                    );
                })}
            </NftsArea>
        </Container>
    );
}

const Container = styled.div``;

const Row = styled.div`
    display: flex;
    align-items: flex-end;
    gap: 5px;
    width: 100%;
`;

const SearchWrapper = styled.div`
    position: relative;
    width: 100%;
`;

const Autocomplete = styled.div`
    position: absolute;
    top: 100%;
    width: 100%;
    max-height: 200px;
    margin-top: 2px;
    padding: 12px;
    overflow-y: auto;
    // border: 1px solid #dfdfe4;
    border-radius: 6px;
    background-color: #27282c;
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1),
        0 4px 6px -2px rgba(0, 0, 0, 0.05);

    &::-webkit-scrollbar {
        width: 5px !important;
    }

    &::-webkit-scrollbar-thumb {
        border-radius: 8px;
        background: #b3b6b7;
    }
`;

const AutocompleteItem = styled.div`
    display: flex;
    align-items: center;
    padding: 10px 0px;
    font-weight: 400;
    line-height: 24px;
    font-style: normal;
    position: relative;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    cursor: pointer;

    &:hover {
        background-color: #f5f5f5;
        color: #27282c;
    }
`;

const NftsArea = styled.div`
    margin-top: 24px;
    padding: 12px;
    height: 200px;
    background-color: #27282c;
    border-radius: 6px;
`;

const NftBadge = styled.span`
    display: inline-flex;
    align-items: center;
    margin: 5px;
    padding: 3px 6px;
    background-color: #d3e3ff82;
    border-radius: 6px;
    cursor: pointer;
`;

const Icon = styled.img`
    width: 14px;
    height: 14px;
    margin-right: 4px;
`;
