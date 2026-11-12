import HomeNavigation from "@components/nav/home";

import HomeProvider from "@components/context/HomeContext";

import { db } from "@utils/firebaseAdmin";

import { BasicServerSideProps } from "@utils/serverside/BasicServerSideProps";

import HomeFooter from "@components/footer/home";

import FilterProvider from "@components/context/FilterContext";

import useFeed from "@components/hooks/useFeed";

import styled from "styled-components";

import Header from "@components/collectionpage/Header";

import CollectionSpaces from "@components/collectionpage/Spaces";

import Sidebar from "@components/collectionpage/Sidebar";

import { formatCollection } from "@utils/collections/format";

import dynamic from "next/dynamic";

import { showModal } from "@components/Dialogs";

import { isValidAddress } from "@utils/getAddrType";

import { useEffect, useState } from "react";

import { useSyncState } from "@components/hooks/useSyncState";
import { amplitude_logAnalyticsEvent } from "@utils/analytics";

const Error = dynamic(() => import("../../components/Error"));

export default function Collection({
    slug,
    collection: _collection,
    isEditable,
}) {
    const [collection, setCollection] = useState<ICollection>(_collection);

    useEffect(() => {
        setCollection(_collection);
    }, [_collection]);

    const feed = collection
        ? useFeed({
              type: "collection",
              tags: collection.tags.map((tag) => `collections:${tag}`),
          })
        : null;

    useEffect(() => {
        if (collection) {
            amplitude_logAnalyticsEvent("view_collection_page", {
                name: collection.name,
                id: collection.id,
                slug: collection.slug,
                tags: collection.tags,
                editors: collection.editors,
                is_nsfw: collection.is_nsfw,
            });
        }
    }, []);

    if (!collection) {
        return <Error statusCode={404} />;
    }

    function syncCollection(collection) {
        setCollection(collection);
    }

    return (
        <Container>
            <HomeProvider hasBorder={false} isFilter={false}>
                <HomeNavigation isLight />

                <Header
                    syncCollection={syncCollection}
                    isEditable={isEditable}
                    collection={collection}
                />

                <FilterProvider
                    defaultFilters={{
                        collections: {
                            [collection.name]: true,
                        },
                    }}
                    feed={feed}
                >
                    <PaddingWrapper>
                        <CollectionFeedWrapper
                            style={{ maxWidth: 1280, margin: "0 auto" }}
                        >
                            <Sidebar collection={collection} feed={feed} />

                            <CollectionSpaces
                                collection={collection}
                                feed={feed}
                            />
                        </CollectionFeedWrapper>
                    </PaddingWrapper>
                </FilterProvider>
                <HomeFooter />
            </HomeProvider>
        </Container>
    );
}

const Container = styled.div``;

export const PaddingWrapper = styled.div`
    padding: 16px 24px;
`;

const CollectionFeedWrapper = styled.div`
    display: flex;
    justify-content: space-between;
    gap: 32px;
    flex-direction: row-reverse;

    @media (max-width: 800px) {
        display: block;
    }
`;

export const getServerSideProps = BasicServerSideProps(
    async ({ params }, user, token) => {
        const { slug } = params;

        let collection = null;

        let ref: any = db.collection("collections");

        if (isValidAddress(slug)) {
            ref = ref.doc(slug);
        } else {
            ref = ref.where("slug", "==", slug);
        }

        const collections = await ref.get();

        const doc: any = collections?.docs?.[0] || collections;

        collection = doc?.data?.();

        if (collection) {
            collection.id = doc.id;
        } else {
            try {
                const response = await fetch(
                    isValidAddress(slug)
                        ? `https://api.opensea.io/api/v1/asset_contract/${slug}`
                        : `https://api.opensea.io/api/v1/collection/${slug}`
                );

                const data = await response.json();

                if (data.collection) {
                    collection = formatCollection(data.collection);

                    if (collection?.contract_address) {
                        await db
                            .collection("collections")
                            .doc(collection.contract_address)
                            .set(collection);

                        collection.id = collection.contract_address;
                    }
                }
            } catch (err) {
                console.log(err);
            }
        }

        return {
            collection: collection?.id ? collection : null,
            slug,
            isEditable: collection?.editors?.includes?.(user?.id) || false,
        };
    }
);
