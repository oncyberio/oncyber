import styled, { useTheme } from "styled-components";
import React, { CSSProperties } from "react";
import dynamic from "next/dynamic";
import { AssetInfo } from "./components/AssetInfo";
import { OrderInfo } from "./components/OrderInfo";
import { useArtworkInfo } from "./components/ArtworkContext";
import { surfaceOfTheme } from "@ui/components/EmptyState";

const Transaction = dynamic(() => import("./components/Transaction"), {
    ssr: false,
});

interface ArtworkInfo_DataProps {
    style?: CSSProperties;
    themeDark: boolean;
    assetInfoRef?: React.MutableRefObject<HTMLDivElement>;
}

export const ArtworkInfo_Data = ({
    style = {},
    assetInfoRef = null,
    themeDark = false,
}: ArtworkInfo_DataProps) => {
    const { marketplace } = useArtworkInfo();
    // Both artwork windows are dark; a legacy light theme still reads light.
    const theme = useTheme() as any;
    const surface = themeDark ? "dark" : surfaceOfTheme(theme);

    return (
        <Container className="artwork-data" style={style}>
            <Transaction />
            <AssetInfo assetInfoRef={assetInfoRef} themeDark={themeDark} />
            {marketplace && <OrderInfo surface={surface} />}
        </Container>
    );
};

const Container = styled.div`
    display: flex;
    flex-direction: column;
    height: 100%;
    width: 100%;
    overflow-y: hidden;

    @media (min-width: 800px) {
        padding: 17px 32px;
    }

    .truncated {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .label {
        font-size: 12px;
        color: ${({ theme }) => theme?.label?.color || "#7a7a7a"};
    }
`;
