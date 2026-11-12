/** @jest-environment jsdom */
import React from "react";
import { createRoot } from "react-dom/client";
import { Simulate } from "react-dom/test-utils";
import { UserContext } from "@components/context/UserContext";
import { FollowButton, FollowingList } from "./Following";
const act = (React as any).act;
(global as any).IS_REACT_ACT_ENVIRONMENT = true;
jest.mock("@components/context/UserContext", () => ({
    UserContext: require("react").createContext({}),
}));
jest.mock("next/dynamic", () => () => () => null);
let root, container;
const auth = { user: { id: "owner" }, authenticated: true, isAnonymous: false };
beforeEach(() => {
    jest.useFakeTimers();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
});
afterEach(() => {
    act(() => root.unmount());
    container.remove();
    jest.useRealTimers();
});
const render = async (children) => {
    await act(async () =>
        root.render(
            <UserContext.Provider value={auth as any}>
                {children}
            </UserContext.Provider>
        )
    );
};
it("resolves a linked-wallet profile and sends canonical directed follow toggles", async () => {
    global.fetch = jest.fn(async (url, options) => ({
        ok: true,
        json: async () =>
            options?.method === "POST"
                ? {
                      accountId: "canonical-friend",
                      following: JSON.parse(options.body).following,
                  }
                : { accountId: "canonical-friend", following: false },
    })) as any;
    await render(<FollowButton accountId="linked-wallet" />);
    expect(container.querySelector("button").textContent).toBe("Follow");
    await act(async () => container.querySelector("button").click());
    const write = (global.fetch as jest.Mock).mock.calls.find(
        ([, options]) => options?.method === "POST"
    );
    expect(JSON.parse(write[1].body)).toEqual({
        accountId: "canonical-friend",
        following: true,
    });
    expect(container.querySelector("button").getAttribute("aria-pressed")).toBe(
        "true"
    );
});
it("shows public-world links only when supplied by the privacy-filtered API", async () => {
    global.fetch = jest.fn(async (url) => ({
        ok: true,
        json: async () =>
            url.endsWith("preferences")
                ? { visibility: "hidden" }
                : {
                      following: [
                          {
                              accountId: "a",
                              name: "A",
                              profileUrl: "/@a",
                              presence: { experienceId: "public-world" },
                          },
                          {
                              accountId: "b",
                              name: "B",
                              profileUrl: "/@b",
                              presence: null,
                          },
                      ],
                  },
    })) as any;
    await render(<FollowingList />);
    expect(container.querySelectorAll('a[href^="/spaces/"]')).toHaveLength(1);
    expect(
        container.querySelector('a[href^="/spaces/"]').getAttribute("href")
    ).toBe("/spaces/public-world");
    expect(container.querySelector("select").value).toBe("hidden");
});
it("persists the creator's presence preference", async () => {
    global.fetch = jest.fn(async (url, options) => ({
        ok: true,
        json: async () =>
            url.endsWith("preferences")
                ? {
                      visibility:
                          options?.method === "PUT"
                              ? JSON.parse(options.body).visibility
                              : "public",
                  }
                : { following: [] },
    })) as any;
    await render(<FollowingList />);
    await act(async () =>
        Simulate.change(container.querySelector("select"), {
            target: { value: "hidden" },
        } as any)
    );
    const write = (global.fetch as jest.Mock).mock.calls.find(
        ([, options]) => options?.method === "PUT"
    );
    expect(JSON.parse(write[1].body)).toEqual({ visibility: "hidden" });
    expect(container.querySelector("select").value).toBe("hidden");
});
