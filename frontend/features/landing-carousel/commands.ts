import type { ComponentProps } from "react";
import type Icon from "./components/Icon";
import { FEED_CATEGORIES } from "./data";
import { DiscoveryFilters } from "./types";

/** One row of the / command menu (landing, lobby and space search bars). */
export interface Command {
    id: string;
    section: string;
    label: string;
    detail?: string;
    icon: ComponentProps<typeof Icon>["name"];
    hint?: string;
    keywords?: string;
    checked?: boolean;
    /** Keep focus where the command put it instead of returning to search. */
    keepFocus?: boolean;
    run: () => void;
}

export function matchesCommand(command: Command, query: string) {
    if (!query) return true;
    const text = `${command.section} ${command.label} ${command.detail || ""} ${
        command.keywords || ""
    }`.toLowerCase();
    return query
        .toLowerCase()
        .split(/\s+/)
        .filter(Boolean)
        .every((word) => text.includes(word));
}

/** Popular / Latest / Staff picks / Oncyber Labs. Staff picks clears the search. */
export function feedCommands(
    selected: string,
    update: (patch: Partial<DiscoveryFilters>) => void
): Command[] {
    return FEED_CATEGORIES.map((category) => ({
        id: `filter-${category.value}`,
        section: "Filter worlds",
        label: category.label,
        icon: "filter" as const,
        keywords: "filter feed sort",
        checked: selected === category.value,
        run: () =>
            update({
                category: category.value,
                ...(category.value === "staff"
                    ? { q: "", chain: "", owner: "", collection: "" }
                    : {}),
            }),
    }));
}

/** Gaussian worlds and games stay out of the menu until they launch. */
export function createCommands(gallery?: () => void): Command[] {
    return [
        gallery && {
            id: "create-gallery",
            section: "Create",
            label: "New gallery",
            detail: "Pick a space for your art",
            icon: "gallery" as const,
            keywords: "space exhibition template new",
            run: gallery,
        },
    ].filter(Boolean) as Command[];
}

export function helpCommands(go: (href: string) => void): Command[] {
    return [
        {
            id: "help-docs",
            section: "Help",
            label: "Docs",
            detail: "Run, build and contribute",
            icon: "book",
            keywords: "documentation guide learn developers three.js",
            run: () => go("/docs"),
        },
        {
            id: "help-contributing",
            section: "Help",
            label: "Contribute",
            detail: "Open source on GitHub",
            icon: "help",
            keywords: "open source github pull request code",
            run: () => go("/docs/contributing"),
        },
    ];
}
