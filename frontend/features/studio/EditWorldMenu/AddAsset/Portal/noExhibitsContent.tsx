import { PanelEmptyState, PanelPlaceholder } from "../shared/PanelContent";

export function noExhibitsContent({ currentStatus, query, selectedExhibits }) {
    if (currentStatus === "search" && !query) {
        return (
            <PanelPlaceholder
                icon="portal"
                title="Search for a world to connect"
            />
        );
    }
    if (selectedExhibits.isLoading) {
        return <PanelEmptyState title="Loading worlds…" />;
    }
    if (selectedExhibits.error) {
        return (
            <PanelEmptyState title="Couldn't load worlds">
                <a
                    href="https://discord.gg/a2MKjxfh6N"
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    Contact support
                </a>
            </PanelEmptyState>
        );
    }
    if (!selectedExhibits.data?.length) {
        return <PanelEmptyState title="No worlds found" />;
    }
    return null;
}
