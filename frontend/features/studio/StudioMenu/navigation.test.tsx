/** @jest-environment jsdom */
import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { renderToStaticMarkup } from "react-dom/server.node";
import { SelectSpace } from "./SelectSpace";
import { ExhibitPicture } from "./components/ExhibitPicture";
import { CYBER_WAREHOUSE_COVER } from "@utils/destinationCover";
import { StudioPlayIcon } from "../components/StudioPlayIcon";
import { UserContext } from "@components/context/UserContext";
import { SpaceList } from "./SelectSpace/SpaceList";

const mockToggleAuth = jest.fn();
const mockToggle = jest.fn();
jest.mock("./context/StudioContext", () => ({
    useStudioMenu: () => ({
        exhibit: { info: { headline: "My world" } },
        toggleAuth: mockToggleAuth,
    }),
}));
jest.mock("@components/context/UserContext", () => ({
    UserContext: require("react").createContext({}),
}));
jest.mock("./SelectSpace/SpaceList", () => ({
    SpaceList: jest.fn(() => <div>Saved worlds</div>),
}));
jest.mock("@features/studio/components/CustomDropdown", () => ({
    CustomDropdown: ({ caption, children }) => (
        <div>
            {caption}
            {children({ toggle: mockToggle })}
        </div>
    ),
}));
jest.mock("@features/studio/components/TextMenuCaption", () => ({
    TextMenuCaption: ({ children }) => <button>{children}</button>,
}));
jest.mock("next/link", () => ({
    __esModule: true,
    default: ({ children, href }) => <a href={href}>{children}</a>,
}));
beforeEach(() => {
    jest.clearAllMocks();
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
});
it("shows the guest draft without mounting account world queries and offers sign-in", () => {
    const host = document.createElement("div");
    const root = createRoot(host);
    act(() =>
        root.render(
            <UserContext.Provider value={{ isAnonymous: true } as any}>
                <SelectSpace
                    onChangeSpace={jest.fn()}
                    onCreateSpace={jest.fn()}
                />
            </UserContext.Provider>
        )
    );
    expect(host.textContent).toContain("My world");
    expect(host.textContent).toContain("Local draft");
    expect(SpaceList).not.toHaveBeenCalled();
    const signIn = [...host.querySelectorAll("button")].find((button) =>
        button.textContent.includes("Sign in")
    );
    act(() => signIn.click());
    expect(mockToggle).toHaveBeenCalledWith(false);
    expect(mockToggleAuth).toHaveBeenCalledWith(true);
    act(() => root.unmount());
});
it("retains the signed-in world picker and its switching action", () => {
    const host = document.createElement("div");
    const root = createRoot(host);
    const change = jest.fn();
    act(() =>
        root.render(
            <UserContext.Provider value={{ isAnonymous: false } as any}>
                <SelectSpace onChangeSpace={change} onCreateSpace={jest.fn()} />
            </UserContext.Provider>
        )
    );
    expect(host.textContent).toContain("Saved worlds");
    expect(host.textContent).not.toContain("Local draft");
    const props = (SpaceList as jest.Mock).mock.calls[0][0];
    const next = { id: "next" };
    props.onChangeSpace(next);
    expect(change).toHaveBeenCalledWith(next);
    expect(mockToggle).toHaveBeenCalledWith(false);
    act(() => root.unmount());
});
it("keeps gradient references distinct when Preview and YouTube render together", () => {
    const html = renderToStaticMarkup(
        <>
            <StudioPlayIcon />
            <StudioPlayIcon />
        </>
    );
    const ids = [...html.matchAll(/id="(playGradient-[^"]+)"/g)].map(
        (match) => match[1]
    );
    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
    ids.forEach((id) => expect(html).toContain(`url(#${id})`));
    expect(html).toContain("M1.70898 14.9805C1.70898 15.9473");
});

it("shows the chosen Warehouse cover in the top nav and draft list despite stale catalog thumbnails", () => {
    const exhibit = { info: { room: "cyberwarehouse" } } as any;
    const destination = {
        slug: "cyberwarehouse",
        thumbnail: "/old-cat.jpg",
        image: "/old-cat-large.jpg",
    } as any;
    const html = renderToStaticMarkup(
        <>
            <ExhibitPicture exhibit={exhibit} destination={destination} />
            <ExhibitPicture exhibit={exhibit} />
        </>
    );
    expect(html.split(`src="${CYBER_WAREHOUSE_COVER}"`)).toHaveLength(3);
    expect(html).not.toContain("old-cat");
});

it.each(["heroImg", "cHeroImg"])(
    "keeps a custom %s above the Warehouse template cover",
    (field) => {
        const html = renderToStaticMarkup(
            <ExhibitPicture
                exhibit={
                    {
                        info: {
                            room: "cyberwarehouse",
                            [field]: "/my-world-cover.jpg",
                        },
                    } as any
                }
            />
        );
        expect(html).toContain('src="/my-world-cover.jpg"');
        expect(html).not.toContain(CYBER_WAREHOUSE_COVER);
    }
);

it("preserves other destination thumbnails and the empty-draft fallback", () => {
    const html = renderToStaticMarkup(
        <ExhibitPicture
            exhibit={{ info: { room: "another-room" } } as any}
            destination={{ thumbnail: "/another-room.jpg" } as any}
        />
    );
    expect(html).toContain('src="/another-room.jpg"');
    expect(
        renderToStaticMarkup(
            <ExhibitPicture exhibit={{ info: { room: "@@empty" } } as any} />
        )
    ).toContain('src="/images/sq_image_placeholder.png"');
});
