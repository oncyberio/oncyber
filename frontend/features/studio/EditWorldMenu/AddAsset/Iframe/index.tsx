import { useDebouncedValue } from "@components/hooks/usDebouncedValue";
import { useState } from "react";
import styled from "styled-components";
import useSWR from "swr";
import { FetchError, fetchIframeDoc } from "./utils";
import { useEventCallback } from "@components/hooks/useEventCallback";
import { useEditWorld } from "../../context/WorldEditContext";
import {
    PanelButton,
    PanelEmptyState,
    PanelField,
    PanelInput,
    PanelPlaceholder,
} from "../shared/PanelContent";

const swrOptions = { revalidateOnFocus: false, refreshInterval: 0 };
const ErrorMsgs: Record<FetchError, string> = {
    BAD_URL: "Enter a full website address, including https://.",
    BLOCKED: "This website doesn't allow embedding. Try another website.",
    NO_FOUND: "We couldn't find a webpage at this address.",
};

export function AddIframe() {
    const { handleAddWebsiteEmbed } = useEditWorld();
    const [query, setQuery] = useState("");
    const q = useDebouncedValue(query, 1000)?.trim();
    const { data, error, isLoading } = useSWR(
        q,
        q ? fetchIframeDoc : null,
        swrOptions
    );
    const isCurrentPreview = query.trim() === q;

    const handleAddClick = useEventCallback((e: React.MouseEvent) => {
        if (isLoading || !data || !isCurrentPreview) return;
        handleAddWebsiteEmbed({
            asset: data,
            keepPlaceholder: e.shiftKey,
            source: "click",
            autoSelect: true,
        });
    }, []);

    return (
        <Container>
            <PanelField>
                <PanelInput
                    id="studio-website-url"
                    aria-label="Website URL"
                    type="url"
                    placeholder="Paste a website URL"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                />
            </PanelField>
            {!q ? (
                <PanelPlaceholder
                    icon="iframe"
                    title="Website preview appears here"
                />
            ) : error ? (
                <PanelEmptyState title="Preview unavailable">
                    {ErrorMsgs[error?.message] || ErrorMsgs.NO_FOUND}
                </PanelEmptyState>
            ) : isLoading || !data ? (
                <PanelEmptyState title="Loading preview…" />
            ) : (
                <>
                    <div className="website-preview">
                        <iframe
                            title="Website preview"
                            sandbox="allow-scripts allow-forms allow-pointer-lock allow-same-origin"
                            scrolling="no"
                            frameBorder="0"
                            src={data.animation_url}
                        />
                    </div>
                    <PanelButton
                        type="button"
                        disabled={!isCurrentPreview}
                        onClick={handleAddClick}
                    >
                        Add to world
                    </PanelButton>
                </>
            )}
        </Container>
    );
}

const Container = styled.div`
    display: flex;
    flex-direction: column;
    min-height: 100%;
    gap: 16px;

    & > .website-preview {
        overflow: hidden;
        border: 1px solid var(--studio-line);
        border-radius: var(--studio-radius-card);
        background: var(--studio-inset);

        & > iframe {
            display: block;
            width: 100%;
            height: 210px;
            pointer-events: none;
        }
    }
`;
