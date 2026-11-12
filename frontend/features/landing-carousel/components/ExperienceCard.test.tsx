/** @jest-environment jsdom */
import React from "react";
import { createRoot } from "react-dom/client";
import { Simulate } from "react-dom/test-utils";
import ExperienceCard, { CoverImage } from "./ExperienceCard";
import { BUILD_CARDS } from "../buildOptions";
import { fallbackCover } from "../coverSources";
const act = (React as any).act;
(global as any).IS_REACT_ACT_ENVIRONMENT = true;
jest.mock("@components/InAppLink", () => ({
    __esModule: true,
    default: ({ children, href }) =>
        require("react").cloneElement(children, { href }),
}));
jest.mock("../activity", () => {
    const signal = jest.fn();
    return { useActivitySignal: () => signal };
});
let root: ReturnType<typeof createRoot>, container: HTMLDivElement;
beforeEach(() => {
    (global as any).IntersectionObserver = class {
        observe() {}
        disconnect() {}
    };
    container = document.createElement("div");
    root = createRoot(container);
});
afterEach(() => act(() => root.unmount()));
function render(imageUrls: string[]) {
    act(() =>
        root.render(
            <CoverImage
                card={
                    {
                        ...BUILD_CARDS[0],
                        imageUrls,
                        panoramaUrl: "/360.jpg",
                    } as any
                }
            />
        )
    );
}
it("uses a placeholder rather than a 360 capture when no ordinary cover is available", () => {
    render([]);
    expect(container.querySelector("img").getAttribute("src")).toBe(
        fallbackCover(BUILD_CARDS[0].id)
    );
});
it("tracks failed covers by URL so refreshed search metadata does not inherit an old fallback index", () => {
    render(["/broken.jpg", "/fallback.jpg"]);
    act(() => Simulate.error(container.querySelector("img")));
    expect(container.querySelector("img").getAttribute("src")).toBe(
        "/fallback.jpg"
    );
    render(["/fresh.jpg"]);
    expect(container.querySelector("img").getAttribute("src")).toBe(
        "/fresh.jpg"
    );
    act(() => Simulate.error(container.querySelector("img")));
    expect(container.querySelector("img").getAttribute("src")).toBe(
        fallbackCover(BUILD_CARDS[0].id)
    );
});

it.each([false, true])(
    "shows availability on the card with flat=%s",
    (flat) => {
        const card = {
            ...BUILD_CARDS[0],
            id: "template-room",
            templateStatus: "uncollected" as const,
            actionLabel: "View gallery details",
        };
        act(() => root.render(<ExperienceCard card={card} flat={flat} />));
        const element = container.querySelector(
            '[data-template-status="uncollected"]'
        );
        expect(element.getAttribute("aria-description")).toBe("Not collected");
        expect(element.querySelector(".template-pill").textContent).toBe(
            "Not collected"
        );
    }
);

it.each([false, true])(
    "shows destination publication status at either density (featured=%s)",
    (featured) => {
        const card = {
            ...BUILD_CARDS[0],
            id: "destination-room",
            title: "My gallery",
            destinationStatus: "Published",
            buildStatus: "Ethereum · Community",
            actionLabel: "Manage My gallery",
            href: "/destinations/room",
        };
        act(() =>
            root.render(<ExperienceCard card={card} featured={featured} />)
        );
        const element = container.querySelector(
            '[data-destination-status="Published"]'
        );
        expect(element.getAttribute("aria-label")).toBe("Manage My gallery");
        expect(element.getAttribute("aria-description")).toBe("Published");
        expect(element.querySelector(".template-pill").textContent).toBe(
            "Published"
        );
        expect(element.textContent).not.toContain("visits");
    }
);

it("shows a loading state on the template being opened", () => {
    const card = {
        ...BUILD_CARDS[0],
        id: "template-room",
        templateStatus: "free" as const,
    };
    act(() => root.render(<ExperienceCard card={card} />));
    expect(container.querySelector(".card-loading")).toBeNull();
    act(() =>
        root.render(<ExperienceCard card={{ ...card, opening: true }} />)
    );
    const element = container.querySelector("[data-opening]");
    expect(element.getAttribute("aria-busy")).toBe("true");
    expect(element.querySelector('[role="status"]').textContent).toBe(
        "Creating your space…"
    );
});

it('labels a world card with its title, then "{room} by {creator}"', () => {
    act(() =>
        root.render(
            <ExperienceCard
                card={
                    {
                        id: "w1",
                        title: "Night Garden",
                        creator: "@mira",
                        room: "void",
                        href: "/night-garden",
                        imageUrls: ["/cover.jpg"],
                        visits: 12,
                    } as any
                }
            />
        )
    );
    expect(container.querySelector("h2").textContent).toBe("Night Garden");
    expect(container.querySelector(".card-meta span").textContent).toBe(
        "Void by mira"
    );
});
