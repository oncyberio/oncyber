import styled from "styled-components";
import { ArtworkEvent } from "./ArtworkEvent";
import { useArtworkInfo } from "../../ArtworkContext";
import { useCyberTranslation } from "@components/context/I18nContext";
import EmptyState from "@ui/components/EmptyState";

export function ArtworkHistory({ className = "" }) {
    //
    const { assetHistory } = useArtworkInfo();

    const { t } = useCyberTranslation();

    let content;

    if (assetHistory.status === "error") {
        content = <FallbackMsg>{t`ARTWORK_HISTORY_UNAVAILABLE`}</FallbackMsg>;
    } else if (assetHistory.status === "loading") {
        content = <FallbackMsg>{t`LOADING_ARTWORK_HISTORY`}</FallbackMsg>;
    } else if (assetHistory.status === "loaded" && !assetHistory.data?.length) {
        // The native artwork panel is dark on every page.
        content = <EmptyState icon="activity" title={t`NO_ARTWORK_HISTORY`} />;
    } else {
        content = assetHistory.data?.map((it, idx) => {
            return <ArtworkEvent key={idx} event={it} />;
        });
    }

    return (
        <Container className={className} error={false}>
            {content}
        </Container>
    );
}

const Container = styled.div<{ error?: boolean }>`
    display: flex;
    flex-direction: column;
    gap: 32px;
    scrollbar-width: none;
    -ms-overflow-style: none;
    &::-webkit-scrollbar {
        display: none;
        width: 0;
        height: 0;
    }

`;

const FallbackMsg = styled.p`
    align-self: center;
    font-size: 16px;
    opacity: 0.6;

    @media (max-width: 550px) {
        font-size: 13px;
    }

    white-space: normal;
`;
