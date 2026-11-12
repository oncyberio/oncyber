import { useCyberTranslation } from "@components/context/I18nContext";
import Spinner from "@ui/components/Spinner";

import { useEffect } from "react";
import styled from "styled-components";

export default function Nfts({ user, nfts, setLoadNfts, otherNfts, isOther }) {
    useEffect(() => {
        setLoadNfts(true);
    }, []);

    const { t } = useCyberTranslation();

    if (!nfts && !otherNfts) return null;

    const result = isOther ? otherNfts : nfts;

    const { data, state } = result || {};

    const halfIndex = Math.ceil((data?.assets || []).length / 2);

    if (state !== "InitialLoading" && (data?.assets?.length === 0 || !data))
        return <div className="no-nft-found">{t`NO_NFTS`}.</div>;

    if (state === "InitialLoading") {
        return (
            <SpinnerWrapper>
                <Spinner />
            </SpinnerWrapper>
        );
    }

    return (
        <SpaceGrid>
            <ColumnContainer data={data?.assets.slice(0, halfIndex)} />
            <ColumnContainer data={data?.assets.slice(halfIndex)} />
        </SpaceGrid>
    );
}

function ColumnContainer({ data }) {
    return (
        <Column>
            {data?.map((asset) => {
                const {
                    token_id,
                    animation_url,
                    image_preview_url,
                    name,
                    token_address,
                } = asset;

                return (
                    <AssetWrapper key={token_id + token_address}>
                        <img src={image_preview_url} />
                        <AssetInfo>
                            <h3>{name}</h3>
                        </AssetInfo>
                    </AssetWrapper>
                );
            })}
        </Column>
    );
}

const SpinnerWrapper = styled.div`
    display: flex;
    justify-content: center;
`;

const SpaceGrid = styled.div`
    display: flex;

    img {
        width: 100%;
        object-fit: cover;
    }
`;

const AssetWrapper = styled.div`
    position: relative;
    margin-bottom: 6px;
    overflow: hidden;
    width: 100%;

    &:hover {
        & > div {
            visibility: visible;
            opacity: 1;
        }
    }
`;

const AssetInfo = styled.div`
    width: 100%;
    height: 100%;
    background: linear-gradient(
        180deg,
        rgba(0, 0, 0, 0) 15.2%,
        rgba(0, 0, 0, 0.7) 66.77%
    );
    position: absolute;
    z-index: 1;
    padding: 12px;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    left: 0;
    top: -3px;
    visibility: hidden;
    opacity: 0;

    transition: all 0.3s ease;

    p {
        margin: 0;
        font-weight: 500;
        font-size: 12px;
        color: #ffffff;
        opacity: 0.5;
    }

    h3 {
        margin: 0;
        font-weight: 700;
        font-size: 16px;
        color: #ffffff;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }
`;

const Column = styled.div`
    &:first-child {
        margin-right: 8px;
    }
`;
