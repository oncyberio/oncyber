import { useScreenSize } from "@components/hooks/useScreenSize";
import { Asset } from "@uitypes/Asset";
import { Experience } from "@uitypes/experience";
import React, { useMemo } from "react";
import styled from "styled-components";
import Artwork from "./Artwork";

export interface ArtworkProps {
    exhibit?: Experience;
    assets?: Asset[];
    handleTeleport?: (asset: Asset) => any;
    setSelectedArtwork: Function;
    toggleInfo: Function;
}

const Artworks = ({
    exhibit,
    assets: _assets,
    handleTeleport,
    setSelectedArtwork,
    toggleInfo,
}: ArtworkProps) => {
    const { width } = useScreenSize();

    const assets = useMemo(() => {
        if (_assets) return _assets;

        const assetsArray = Object.values(exhibit?.artworks || {}).map(
            (art) => art.data
        );

        const processed = assetsArray.filter(
            (a, i) =>
                assetsArray.findIndex(
                    (s) =>
                        a.token_id === s.token_id &&
                        a.token_address === s.token_address
                ) === i
        );

        return processed;
    }, [exhibit?.artworks, _assets]);

    const columns = useMemo(() => {
        let nbCols = width <= 980 ? 2 : 3;

        let cols: Asset[][] = new Array(nbCols);

        for (let i = 0; i < nbCols; i++) {
            cols[i] = [];
        }

        assets.forEach((asset, index) => {
            cols[index % nbCols].push(asset);
        });

        return cols;
    }, [assets, width]);

    const showPayment = (asset) => {
        setSelectedArtwork(asset);
        toggleInfo();
    };

    return (
        <Container id="viewing">
            {columns.map((column, index) => {
                return (
                    <div key={index}>
                        {column.map((asset, index) => {
                            if (
                                asset?.mime_type === "cyber/text"
                                || asset?.mime_type === "embed/youtube"
                                || asset?.mime_type === "embed/html/website") return null;

                            return (
                                <Artwork
                                    handleTeleport={() => handleTeleport(asset)}
                                    asset={asset}
                                    showPayment={showPayment}
                                    key={asset.id + `${index}`}
                                    id={asset.id}
                                />
                            );
                        })}
                    </div>
                );
            })}
            {/* <ArtworksWrapper>
            { Object.keys(assets).map((key, id) => {
                return <Artwork
                    asset={assets[key]?.data}
                    showPayment={showPayment}
                    key={ id }
                    id={id} />
            })}
        </ArtworksWrapper> */}
        </Container>
    );
};

const Container = styled.div`
    min-width: 100%;
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    grid-gap: 8px;
    position: relative;

    & > div {
        width: 100%;
    }

    @media (max-width: 980px) {
        grid-template-columns: 1fr 1fr;
    }

    @media (max-width: 550px) {
        grid-template-columns: 1fr;
    }
`;

export default Artworks;
