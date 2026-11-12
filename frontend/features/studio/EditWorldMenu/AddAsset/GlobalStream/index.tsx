import { useEventCallback } from "@components/hooks/useEventCallback";
import { useState } from "react";
import styled from "styled-components";
import { useEditWorld } from "../../context/WorldEditContext";
import {
    PanelButton,
    PanelField,
    PanelInput,
    PanelNote,
} from "../shared/PanelContent";

export default function GlobalStream() {
    const { handleAddGlobalStream } = useEditWorld();
    const [url, setUrl] = useState("");

    const handleAddGlobalStreamClick = useEventCallback(
        async (e: React.MouseEvent) => {
            if (!url.trim()) return;
            await handleAddGlobalStream({
                url: url.trim(),
                keepPlaceholder: e.shiftKey,
                autoSelect: true,
            });
        },
        []
    );

    return (
        <Container>
            <PanelField>
                <PanelInput
                    id="studio-audio-url"
                    aria-label="Audio stream URL"
                    aria-describedby="studio-audio-hint"
                    type="url"
                    placeholder="Paste an audio stream URL"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                />
                <PanelNote id="studio-audio-hint">
                    Direct stream · Icecast / SHOUTcast
                </PanelNote>
            </PanelField>
            <PanelButton
                type="button"
                disabled={!url.trim()}
                onClick={handleAddGlobalStreamClick}
            >
                Add audio stream
            </PanelButton>
        </Container>
    );
}

const Container = styled.div`
    display: flex;
    flex-direction: column;
    gap: 20px;
`;
