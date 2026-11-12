import { LandingCard } from "./types";

export type CreationStep = "gallery" | "explore";

/** Creation links open the gallery template catalog; everything else explores. */
export function creationStep(pathname: string, value: unknown): CreationStep {
    const isCreationRoute = [
        "/studio/new-gallery",
        "/studio/new-splat",
    ].includes(pathname);
    const step = value || (isCreationRoute ? "gallery" : "explore");
    return ["gallery", "choose", "gaussian"].includes(step as string)
        ? "gallery"
        : "explore";
}

export function creationToggleStep(step: CreationStep): CreationStep {
    return step === "explore" ? "gallery" : "explore";
}

/** Setup cards are form cells rendered by their owner, not destination links. */
export function isSetupCard(card: LandingCard): boolean {
    return card.id.startsWith("setup-");
}
