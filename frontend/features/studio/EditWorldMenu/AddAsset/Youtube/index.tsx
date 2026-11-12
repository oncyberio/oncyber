import styled from "styled-components";
import { useState } from "react";
import useSWR from "swr";
import { useDebouncedValue } from "@components/hooks/usDebouncedValue";
import { formatYoutubeAsset, searchYoutubeBykeyword } from "./utils";
import { DRAG_MIMES } from "@components/_3DExhibit-v2/three/constants";
import { useEditWorld } from "../../context/WorldEditContext";
import {
    Preview,
    PreviewGrid,
    PreviewImgWrapper,
    PreviewTitle,
} from "../shared/Preview";
import { useEventCallback } from "@components/hooks/useEventCallback";
import {
    PanelEmptyState,
    PanelField,
    PanelInput,
    PanelPlaceholder,
} from "../shared/PanelContent";

export function AddYoutube() {
    const { handleAddYoutubeEmbed, handleDragStart } = useEditWorld();
    const [query, setQuery] = useState("");
    const debouncedQuery = useDebouncedValue(query, 1000);
    const q = debouncedQuery?.trim();
    const { data, error } = useSWR(q, searchYoutubeBykeyword);

    const handleDrag = useEventCallback((it, e) => {
        const asset = formatYoutubeAsset(it);
        handleDragStart(e as any, DRAG_MIMES.YOUTUBE, {
            previewUrl: asset.image_preview_url,
            asset,
            mime: DRAG_MIMES.YOUTUBE,
        });
    }, []);

    const handleClick = useEventCallback((it, e: React.MouseEvent) => {
        const asset = formatYoutubeAsset(it);
        handleAddYoutubeEmbed({
            asset,
            keepPlaceholder: e.shiftKey,
            source: "click",
            autoSelect: true,
        });
    }, []);

    let content;
    if (!q) {
        content = (
            <PanelPlaceholder icon="youtube" title="Find a video to preview" />
        );
    } else if (error) {
        content = (
            <PanelEmptyState title="Couldn't load videos">
                Try another search or link.
            </PanelEmptyState>
        );
    } else if (!data) {
        content = <PanelEmptyState title="Loading videos…" />;
    } else if (!data.items.length) {
        content = <PanelEmptyState title="No videos found" />;
    } else {
        content = (
            <PreviewGrid className="yt-grid" columns={2}>
                {data.items.map((it) => {
                    const title = it.snippet.title || "";
                    return (
                        <Preview
                            key={
                                typeof it.id === "string"
                                    ? it.id
                                    : it.id.videoId
                            }
                            image={
                                <img
                                    src={it.snippet.thumbnails.high.url}
                                    alt={title}
                                    width={144}
                                    height={81}
                                    loading="lazy"
                                    draggable
                                    onDragStart={(e) => handleDrag(it, e)}
                                />
                            }
                            title={title}
                            onClick={(e) => handleClick(it, e)}
                        />
                    );
                })}
            </PreviewGrid>
        );
    }

    return (
        <Container>
            <PanelField>
                <PanelInput
                    id="studio-youtube-query"
                    aria-label="Search YouTube videos or paste a link"
                    placeholder="Search videos or paste a link"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                />
            </PanelField>
            {content}
        </Container>
    );
}

const Container = styled.div`
    display: flex;
    flex-direction: column;
    min-height: 100%;
    gap: 18px;

    ${PreviewImgWrapper} {
        border: 1px solid #303035;
        border-radius: 8px;
        background: var(--studio-surface, #1c1c1f);
        transition: border-color 150ms ease;
        &:hover {
            border-color: #777780;
        }
        & > img {
            display: block;
            width: 100%;
            height: auto;
            aspect-ratio: 16 / 9;
            object-fit: cover;
        }
    }

    ${PreviewTitle} {
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        margin-top: 4px;
        white-space: normal;
        color: #c6c6ce;
        font-size: 12px;
        line-height: 17px;
    }
`;
