/** @jest-environment jsdom */
import { act } from "react";
import { createRoot } from "react-dom/client";
import BottomSearch from "./BottomSearch";

let root: ReturnType<typeof createRoot>, container: HTMLDivElement;
beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
});
afterEach(() => {
    act(() => root.unmount());
    container.remove();
});

const input = () => container.querySelector("input") as HTMLInputElement;
const render = (props: any) =>
    act(() =>
        root.render(<BottomSearch onSearch={jest.fn()} value="" {...props} />)
    );

test("starts with the words of a missing link, without searching", () => {
    const onSearch = jest.fn();
    render({ defaultQuery: "frahm genesis", onSearch });
    expect(input().value).toBe("frahm genesis");
    expect(onSearch).not.toHaveBeenCalled();
});

test("submitting searches for those words", () => {
    const onSearch = jest.fn();
    render({ defaultQuery: "frahm genesis", onSearch });
    act(() => {
        input().form?.requestSubmit?.() ??
            input()
                .closest("form")!
                .dispatchEvent(
                    new Event("submit", { bubbles: true, cancelable: true })
                );
    });
    expect(onSearch).toHaveBeenCalledWith("frahm genesis");
});

test("a search that is running wins over the default text", () => {
    render({ defaultQuery: "frahm genesis" });
    render({ defaultQuery: "frahm genesis", value: "frahm" });
    expect(input().value).toBe("frahm");
});
