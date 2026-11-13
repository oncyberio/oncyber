/** @jest-environment jsdom */
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import useRecordingCrowd from "./useRecordingCrowd";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

test("hands back the same crowd on every render", async () => {
    window.history.replaceState(null, "", "/?crowd=6&lobby=1");
    const seen: ReturnType<typeof useRecordingCrowd>[] = [];
    function Probe({ pass }: { pass: number }) {
        seen[pass] = useRecordingCrowd();
        return null;
    }
    const root = createRoot(document.createElement("div"));
    await act(async () => root.render(<Probe pass={0} />));
    await act(async () => root.render(<Probe pass={0} />));
    expect(seen[0]).not.toBeNull();
    await act(async () => root.render(<Probe pass={1} />));
    // Effects depend on this object. A new one each render kept one of them
    // running forever after a party trip, so leaving the lobby never
    // finished and the landing never got its search back.
    expect(seen[1]).toBe(seen[0]);
    await act(async () => root.unmount());
    window.history.replaceState(null, "", "/");
});
