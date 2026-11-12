import { fetchLobbyPopulation } from "./useLobbyPopulation";
import { selectLobbyEndpoint } from "./lobbyEndpoints";

jest.mock("./lobbyEndpoints", () => ({ selectLobbyEndpoint: jest.fn() }));

const json = (value: unknown) => Promise.resolve({ json: () => Promise.resolve(value) });

beforeEach(() => { (global as any).fetch = jest.fn(); });

test("default arena: sums clients of the lobby room only", async () => {
    (selectLobbyEndpoint as jest.Mock).mockResolvedValue({ id: "default", httpUrl: "https://arena" });
    (fetch as jest.Mock).mockReturnValue(json({ success: true, rooms: [
        { clients: 3, metadata: { spaceId: "oncyber-lobby-v1" } },
        { clients: 9, metadata: { spaceId: "some-gallery" } },
        { clients: 2, metadata: { spaceId: "oncyber-lobby-v1" } },
    ] }));
    expect(await fetchLobbyPopulation(new AbortController().signal)).toBe(5);
    expect(fetch).toHaveBeenCalledWith("https://arena/getRooms", expect.anything());
});

test("an empty arena is zero, a broken list is unknown", async () => {
    (selectLobbyEndpoint as jest.Mock).mockResolvedValue({ id: "default", httpUrl: "https://arena" });
    (fetch as jest.Mock).mockReturnValueOnce(json({ success: true, rooms: [] }));
    expect(await fetchLobbyPopulation(new AbortController().signal)).toBe(0);
    (fetch as jest.Mock).mockReturnValueOnce(json({ success: false }));
    expect(await fetchLobbyPopulation(new AbortController().signal)).toBeNull();
});

test("regional world servers report population on health", async () => {
    (selectLobbyEndpoint as jest.Mock).mockResolvedValue({ id: "eu", httpUrl: "https://eu", protocol: 2 });
    (fetch as jest.Mock).mockReturnValue(json({ lobbyProtocol: 2, population: 41 }));
    expect(await fetchLobbyPopulation(new AbortController().signal)).toBe(41);
});
