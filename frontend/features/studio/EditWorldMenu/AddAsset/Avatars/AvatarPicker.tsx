import React, { useEffect, useMemo, useState } from "react";
import styled from "styled-components";
import VRMS from "@3/three/factory/player/vrms.json";
import {
    LibraryCard,
    LibraryGrid,
    LibrarySearch,
    LibraryTabs,
} from "../shared/Library";
import { PanelEmptyState, PanelNote } from "../shared/PanelContent";
export const STUDIO_AVATARS = Object.values(VRMS).filter(
    (avatar) => !(avatar as { hidden?: boolean }).hidden
);
export type StudioAvatar = (typeof STUDIO_AVATARS)[number];
export function AvatarPicker({
    pending,
    available = () => true,
    onWarm,
    onPick,
    onDrag,
    uploads,
    visitors,
    hint = "Click or drag to place. Choose an animation after adding.",
}: {
    hint?: string;
    pending: string | null;
    available?: (avatar: StudioAvatar) => boolean;
    onWarm?: (avatar: StudioAvatar) => void;
    onPick: (
        avatar: StudioAvatar,
        event: React.MouseEvent<HTMLButtonElement>
    ) => unknown;
    onDrag: (
        avatar: StudioAvatar,
        event: React.DragEvent<HTMLButtonElement>
    ) => void;
    uploads: React.ReactNode;
    visitors: React.ReactNode;
}) {
    const [view, setView] = useState("default");
    const [query, setQuery] = useState("");
    const shown = useMemo(
        () =>
            STUDIO_AVATARS.filter((avatar) =>
                avatar.name.toLowerCase().includes(query.trim().toLowerCase())
            ),
        [query]
    );
    useEffect(() => {
        if (view !== "default" || !shown[0] || !onWarm) return;
        const timer = window.setTimeout(() => onWarm(shown[0]), 200);
        return () => window.clearTimeout(timer);
    }, [view, shown, onWarm]);
    return (
        <Container>
            <LibraryTabs role="group" aria-label="Avatar source">
                {[
                    { value: "default", title: "Oncyber" },
                    { value: "uploads", title: "Your models" },
                    { value: "visitors", title: "Visitors" },
                ].map((tab) => (
                    <button
                        key={tab.value}
                        type="button"
                        aria-pressed={view === tab.value}
                        onClick={() => setView(tab.value)}
                    >
                        {tab.title}
                    </button>
                ))}
            </LibraryTabs>
            {view === "visitors" ? (
                visitors
            ) : (
                <>
                    {view === "uploads" ? (
                        uploads
                    ) : (
                        <>
                            <LibrarySearch
                                value={query}
                                onChange={setQuery}
                                placeholder="Search avatars"
                            />
                            <LibraryGrid $columns={3}>
                                {shown.map((avatar) => (
                                    <LibraryCard
                                        key={avatar.id}
                                        name={avatar.name}
                                        image={avatar.image}
                                        imageCrossOrigin="anonymous"
                                        onPointerEnter={() => onWarm?.(avatar)}
                                        onFocus={() => onWarm?.(avatar)}
                                        disabled={
                                            pending !== null ||
                                            !available(avatar)
                                        }
                                        onClick={(e) => onPick(avatar, e)}
                                        onDragStart={(e) => onDrag(avatar, e)}
                                    />
                                ))}
                            </LibraryGrid>
                            {pending && (
                                <PanelNote role="status">
                                    Adding avatar…
                                </PanelNote>
                            )}
                            {!shown.length && (
                                <PanelEmptyState title="No matching avatars" />
                            )}
                            <PanelNote>{hint}</PanelNote>
                        </>
                    )}
                </>
            )}
        </Container>
    );
}
const Container = styled.div`
    display: flex;
    flex-direction: column;
    gap: 12px;
`;
