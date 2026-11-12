/** @jest-environment jsdom */
import React from "react";
import { createRoot } from "react-dom/client";
import { UserContext } from "@components/context/UserContext";
import PartyPanel from "./PartyPanel";
const act = (React as any).act;
(global as any).IS_REACT_ACT_ENVIRONMENT = true;
jest.mock("@components/context/UserContext", () => ({
    UserContext: require("react").createContext({}),
}));
let root, container, state, writes;
const travel = jest.fn();
const destination = {
    experienceId: "shared",
    instanceId: "room-1",
    url: "/s@shared",
};
beforeEach(() => {
    jest.useFakeTimers();
    Object.defineProperty(global, "crypto", {
        configurable: true,
        value: { randomUUID: () => "test-request" },
    });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    travel.mockClear();
    writes = [];
    state = {
        selfId: "canonical-me",
        party: null,
        invitations: [
            {
                id: "invite",
                partyId: "party",
                fromId: "friend",
                fromName: "Alex",
                expiresAt: Date.now() + 60000,
            },
        ],
    };
    global.fetch = jest.fn(async (url, options) => {
        if (url.endsWith("parties") && options?.method === "POST") {
            const body = JSON.parse(options.body);
            writes.push(body);
            if (body.action === "respond") {
                state.invitations = [];
                if (body.accept)
                    state.party = {
                        id: "party",
                        leaderId: "friend",
                        members: [{ id: "canonical-me", name: "Me" }],
                        destination,
                    };
            }
            if (body.action === "leave") state.party = null;
        }
        return {
            ok: true,
            json: async () =>
                url.endsWith("social") ? { friends: [{ uid: "friend-2", name: "Sam" }] } : state,
        };
    }) as any;
});
afterEach(() => {
    act(() => root.unmount());
    container.remove();
    jest.useRealTimers();
});
const render = async (experienceId = "current") =>
    act(async () =>
        root.render(
            <UserContext.Provider
                value={
                    {
                        user: { id: "linked-wallet" },
                        userData: { id: "canonical-me" },
                        authenticated: true,
                        isAnonymous: false,
                    } as any
                }
            >
                <PartyPanel
                    experienceId={experienceId}
                    onTravel={travel}
                    onSignIn={jest.fn()}
                />
            </UserContext.Provider>
        )
    );
const button = (name) =>
    Array.from(container.querySelectorAll("button")).find(
        (item: HTMLButtonElement) => item.textContent === name
    ) as HTMLButtonElement;
it("accepts an invitation explicitly and only travels on a separate user action", async () => {
    await render();
    expect(writes).toHaveLength(0);
    expect(travel).not.toHaveBeenCalled();
    await act(async () => button("Accept invitation").click());
    expect(writes[0]).toMatchObject({
        action: "respond",
        invitationId: "invite",
        accept: true,
    });
    expect(travel).not.toHaveBeenCalled();
    await act(async () => button("Join party's world").click());
    expect(travel).toHaveBeenCalledWith(destination);
    await act(async () => button("Leave party").click());
    expect(writes[1]).toMatchObject({ action: "leave" });
});
it("declining never joins or travels", async () => {
    await render();
    await act(async () => button("Decline").click());
    expect(writes[0]).toMatchObject({ action: "respond", accept: false });
    expect(button("Join party's world")).toBeUndefined();
    expect(travel).not.toHaveBeenCalled();
});
it("recognizes canonical leadership after linked-wallet sign-in", async () => {
    state.party = {
        id: "party",
        leaderId: "canonical-me",
        members: [{ id: "canonical-me", name: "Me" }],
    };
    state.invitations = [];
    await render();
    await act(async () => button("Bring party to this world").click());
    expect(writes[0]).toMatchObject({
        action: "move",
        experienceId: "current",
    });
});

it("offers accepted friends and shows each member's travel progress", async () => {
    state.party = { id: "party", leaderId: "canonical-me", members: [{ id: "canonical-me", name: "Me", state: "ready" }, { id: "friend", name: "Alex", state: "failed" }] };
    await render();
    expect(container.textContent).toContain("Invite a friend");
    expect(container.textContent).toContain("Ready");
    expect(container.textContent).toContain("Could not connect");
    expect(container.querySelector('option[value="friend-2"]').textContent).toBe("Sam");
    expect(global.fetch).toHaveBeenCalledWith("/api/social", expect.objectContaining({ body: JSON.stringify({ operation: "snapshot" }) }));
});

it("explains an unavailable destination without exposing an internal error code", async () => {
    state.party = { id: "party", leaderId: "canonical-me", members: [{ id: "canonical-me", name: "Me" }] };
    await render();
    (global.fetch as jest.Mock).mockImplementationOnce(async () => ({ ok: false, status: 409, json: async () => ({ error: "PARTY_DESTINATION_UNSUPPORTED" }) }));
    await act(async () => button("Bring party to this world").click());
    expect(container.textContent).toContain("Party travel is not available for this world yet");
    expect(container.textContent).not.toContain("PARTY_DESTINATION_UNSUPPORTED");
    expect(travel).not.toHaveBeenCalled();
});


it("lobby party controls keep invitations but hide the current-world move without a destination", async () => {
    state.party = { id: "party", leaderId: "canonical-me", members: [{ id: "canonical-me", name: "Me" }] };
    await render(null);
    expect(button("Bring party to this world")).toBeUndefined();
    expect(button("Send invitation")).toBeDefined();
});
