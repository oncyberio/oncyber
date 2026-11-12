import { marketplaceProfileUrl } from "@utils/marketplaceProfile";
import React, { useMemo } from "react";
import styled, { css } from "styled-components";

import { formatUser } from "../../utils";
import { Profile } from "./Profile";
import { Owners } from "./Owners";
import { useArtworkInfo } from "../../ArtworkContext";
import { Creator } from "./Creator";

import { useCyberTranslation } from "@components/context/I18nContext";

type OwnershipType = React.HTMLProps<HTMLButtonElement> & {
    responsive?: boolean;
    isMobile?: boolean;
    style?: React.CSSProperties;
};

export function Ownership({
    responsive = true,
    style = {},
    isMobile,
}: OwnershipType) {
    //
    const { asset } = useArtworkInfo();

    const { t } = useCyberTranslation();

    const hasCreator = asset?.creator?.address != null;
    // A zero prefix is valid; only the full zero address lacks a collector.
    const hasOwner =
        !!asset?.owner?.address && !/^0x0{40}$/i.test(asset.owner.address);

    const owners = useMemo(() => {
        return asset.ownerships?.map((it) => {
            return { owner: formatUser(it.owner), quantity: it.quantity };
        });
    }, [asset.ownerships]);

    const lis = useMemo(() => {
        let lis = [];

        if (hasOwner) {
            let content: React.ReactNode;

            if (owners?.length > 1) {
                content = <Owners owners={owners} supply={asset.supply} />;
            } else {
                content = (
                    <Profile
                        key={asset.owner.address}
                        label={t`COLLECTED_BY`}
                        url={marketplaceProfileUrl(
                            asset?.owner?.address,
                            asset?.account_base_url
                        )}
                        user={formatUser(asset?.owner)}
                    />
                );
            }

            lis.push(
                <Column
                    key="collected-by"
                    label={t`COLLECTED_BY`}
                    content={content}
                />
            );
        }

        if (hasCreator) {
            lis.push(
                <Column
                    key="created-by"
                    label={"Created By"}
                    content={<Creator />}
                />
            );
        }

        return lis;
    }, [asset]);

    return (
        <Container style={style} className="d-artwork-ownership">
            <InfoList
                className={responsive ? "responsive" : ""}
                isMobile={isMobile}
            >
                {lis}
            </InfoList>
        </Container>
    );
}

function Column({ label, content, className = "" }) {
    return <div className={`column ${className}`}>{content}</div>;
}

export const Container = styled.div`
    display: flex;
    flex-direction: row;
    gap: 8px;
    justify-content: start;
    align-items: flex-end;
    width: 100%;

    & .column {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 4px;

        & .label {
            height: 16px;
            font-weight: 400;
            font-size: 12px;
            color: #7a7a7a;
            margin-left: 4px;
        }

        & .show-more {
            padding: 8px;
            border: 1px solid rgba(255, 255, 255, 0.2);
            border-radius: 200px;
            cursor: pointer;
            margin-bottom: 4px;

            & .img {
                filter: invert(1);
            }
        }
    }
`;

const InfoList = styled.div<{ isMobile: boolean }>`
    --min-item-width: 180px;
    --max-item-width: 180px;

    display: flex;
    gap: 8px;

    ${({ isMobile }) => {
        return isMobile
            ? css`
                  flex-direction: column;

                  @media (orientation: landscape) {
                      flex-direction: row;
                  }
              `
            : css`
                  flex-direction: row;
              `;
    }}

    /* @media (max-width: 600px) {
        &:not(.responsive) {
            --max-item-width: 100%;

            & > :last-child {
                display: none;
            }
        }
    } */

    @media (max-width: 1300px) {
        &.responsive {
            --min-item-width: 180px;
            flex-direction: column-reverse;
            align-items: flex-start;
        }
    }
`;
