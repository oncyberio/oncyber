import { PanelEmptyState, PanelPlaceholder } from "../shared/PanelContent";
import { tx } from "@components/context/I18nContext";

export function noExhibitsContent({ currentStatus, query, selectedExhibits }) {
    if (currentStatus === "search" && !query) {
        return (
            <PanelPlaceholder
                icon="portal"
                title={tx("Search for a world to connect")}
            />
        );
    }
    if (selectedExhibits.isLoading) {
        return <PanelEmptyState title={tx("Loading worlds…")} />;
    }
    if (selectedExhibits.error) {
        return (
            <PanelEmptyState title={tx("Couldn't load worlds")}>
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
        return <PanelEmptyState title={tx("No worlds found")} />;
    }
    return null;
}
