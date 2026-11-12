/** @jest-environment jsdom */
import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react-dom/test-utils";
import useCardTransition from "./hooks/useCardTransition";
import { cardOpacity, transitionDuration } from "./transitions";

let state: ReturnType<typeof useCardTransition>;
let changeMotion: () => void;
let reduced = false;
function Harness({ name }: { name: string }) {
    const cards = React.useMemo(() => [{ id: name }] as any, [name]);
    state = useCardTransition(cards, name, 4);
    return <div>{state.cards[0]?.id}</div>;
}
beforeEach(() => {
    jest.useFakeTimers();
    reduced = false;
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    window.matchMedia = jest.fn(() => ({
        get matches() {
            return reduced;
        },
        addEventListener: (_, fn) => {
            changeMotion = fn;
        },
        removeEventListener: jest.fn(),
    })) as any;
});
afterEach(() => jest.useRealTimers());
it("fades cards in sequence and completes exactly at the last card", () => {
    const out = { phase: "out" as const, started: 100 };
    expect(cardOpacity(out, 155, 0)).toBeLessThan(1);
    expect(cardOpacity(out, 155, 1)).toBe(1);
    expect(cardOpacity(out, 100 + transitionDuration("out", 4), 3)).toBe(0);
    const incoming = { phase: "in" as const, started: 0 };
    expect(cardOpacity(incoming, 110, 0)).toBeGreaterThan(
        cardOpacity(incoming, 110, 1)
    );
    expect(cardOpacity(incoming, transitionDuration("in", 4), 3)).toBe(1);
});
it("retains outgoing cards until their exit and uses the latest destination", () => {
    const root = createRoot(document.createElement("div"));
    act(() => root.render(<Harness name="explore" />));
    act(() => root.render(<Harness name="create" />));
    expect(state.cards[0].id).toBe("explore");
    expect(state.busy).toBe(true);
    act(() => root.render(<Harness name="templates" />));
    act(() => jest.advanceTimersByTime(transitionDuration("out", 4)));
    expect(state.cards[0].id).toBe("templates");
    expect(state.motion.current.phase).toBe("in");
    act(() => jest.advanceTimersByTime(transitionDuration("in", 4)));
    expect(state.busy).toBe(false);
    act(() => root.unmount());
    expect(jest.getTimerCount()).toBe(0);
});
it("finishes immediately when reduced motion is enabled mid-transition", () => {
    const root = createRoot(document.createElement("div"));
    act(() => root.render(<Harness name="create" />));
    act(() => root.render(<Harness name="templates" />));
    act(() => {
        reduced = true;
        changeMotion();
    });
    expect(state.cards[0].id).toBe("templates");
    expect(state.busy).toBe(false);
    expect(jest.getTimerCount()).toBe(0);
    act(() => root.render(<Harness name="create" />));
    expect(state.cards[0].id).toBe("create");
    expect(state.busy).toBe(false);
    act(() => root.unmount());
});
it("cancels a pending card replacement on unmount", () => {
    const root = createRoot(document.createElement("div"));
    act(() => root.render(<Harness name="create" />));
    act(() => root.render(<Harness name="templates" />));
    act(() => root.unmount());
    expect(jest.getTimerCount()).toBe(0);
});

it("applies world filters immediately without waiting for a card transition", () => {
    const root = createRoot(document.createElement("div"));
    act(() => root.render(<Harness name="explore:all" />));
    act(() => root.render(<Harness name="explore:6529" />));
    expect(state.cards[0].id).toBe("explore:6529");
    expect(state.busy).toBe(false);
    expect(state.motion.current.phase).toBe("idle");
    act(() => root.render(<Harness name="explore:all" />));
    expect(state.cards[0].id).toBe("explore:all");
    act(() => root.unmount());
    expect(jest.getTimerCount()).toBe(0);
});
