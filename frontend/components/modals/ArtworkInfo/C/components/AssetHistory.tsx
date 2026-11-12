import { useCyberTranslation } from "@components/context/I18nContext";
import { useMemo, useState } from "react";
import styled, { useTheme } from "styled-components";
import EmptyState, { surfaceOfTheme } from "@ui/components/EmptyState";
import { useArtworkInfo } from "./ArtworkContext";
import { Horz, Vert } from "../style/Flex";
import { CryptoPrice } from "./Price";

import { useCyberTheme } from "@components/context/ThemeProvider";
import { AssetTimeline } from "./Timeline";

export function AssetHistory() {
    const { t } = useCyberTranslation();
    const { assetHistory } = useArtworkInfo();
    const theme = useTheme() as any;

    let content;

    if (assetHistory.status === "error") {
        content = <FallbackMsg>{t`ARTWORK_HISTORY_UNAVAILABLE`}</FallbackMsg>;
    } else if (assetHistory.status === "loading") {
        content = <FallbackMsg>{t`LOADING_ARTWORK_HISTORY`}</FallbackMsg>;
    } else if (assetHistory.status === "loaded" && !assetHistory.data?.length) {
        content = (
            <EmptyState
                surface={surfaceOfTheme(theme)}
                icon="activity"
                title={t`NO_ARTWORK_HISTORY`}
            />
        );
    } else if (assetHistory.status === "loaded") {
        content = <AssetTimeline events={assetHistory.data} />;
    }

    return (
        <Container error={false}>
            <Content>{content}</Content>
        </Container>
    );
}

const Container = styled.div<{ error?: boolean }>`
    flex: 1;
    display: flex;
    align-items: flex-start;
    justify-content: center;
    font-size: 12px;
    font-weight: 400;
    overflow-y: auto;
    scrollbar-width: none;
    -ms-overflow-style: none;
    &::-webkit-scrollbar {
        display: none;
        width: 0;
        height: 0;
    }

    border-radius: 8px;
`;

const Content = styled.div`
    flex: 1;
`;

const FallbackMsg = styled.p`
    align-self: center;
    font-size: 16px;
    opacity: 0.6;

    @media (max-width: 550px) {
        font-size: 13px;
    }
`;
