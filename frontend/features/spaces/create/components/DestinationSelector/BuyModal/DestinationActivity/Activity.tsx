import styled, { useTheme } from "styled-components";
import EmptyState, { surfaceOfTheme } from "@ui/components/EmptyState";
import { useNftBuyContext } from "@components/context/NftBuyContext";
import { AssetTimeline } from "@components/modals/ArtworkInfo/C/components/Timeline";

export function Activity() {
    const { assetHistory } = useNftBuyContext();
    const surface = surfaceOfTheme(useTheme() as any);

    let content;

    if (assetHistory.status === "error") {
        content = <FallbackMsg> {assetHistory.error}</FallbackMsg>;
    } else if (assetHistory.status === "loading") {
        content = <FallbackMsg>Loading price data…</FallbackMsg>;
    } else if (assetHistory.status === "idle" || !assetHistory.data?.length) {
        content = (
            <EmptyState
                surface={surface}
                icon="activity"
                title="No activity yet."
            />
        );
    } else {
        content = <AssetTimeline events={assetHistory.data} />;
    }

    return (
        <Container error={false} className="scrollbar">
            <Content>{content}</Content>
        </Container>
    );
}

const Container = styled.div<{ error?: boolean }>`
    display: flex;
    align-items: flex-start;
    justify-content: center;
    font-size: 12px;
    font-weight: 400;
    overflow-y: auto;
    border-radius: 8px;
`;

const Content = styled.div`
    height: 100%;
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
