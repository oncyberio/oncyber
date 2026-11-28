/** @jest-environment node */
import { fetchOwnedAutographAssets, isAutographUser } from "./autographAssets";

const fetchMock = jest.fn<Promise<any>, any[]>(async () => ({
    ok: false,
    status: 404,
}));
const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

beforeAll(() => {
    (global as any).fetch = fetchMock;
});
beforeEach(() => {
    fetchMock.mockClear();
    errorSpy.mockClear();
});

test.each([
    ["an email/guest account id", "TV1NLeTIKmMkotUEpGSbPk68Fwf2"],
    ["a Tezos address", "tz1VSUr8wwNhLAzempoch5d6hLRiTh8Cjcjb"],
    ["nothing", ""],
])("%s is not looked up", async (_n, id) => {
    await expect(isAutographUser(id)).resolves.toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
});

test("an Ethereum wallet is still looked up", async () => {
    await isAutographUser("0x0000000000000000000000000000000000000001");
    expect(fetchMock).toHaveBeenCalled();
});

test("a wallet with nothing there lists nothing", async () => {
    await expect(
        fetchOwnedAutographAssets("0x0000000000000000000000000000000000000002")
    ).resolves.toEqual({ assets: [], hasMore: false });
});

test("a failed lookup is reported as an error, not an empty list", async () => {
    fetchMock.mockRejectedValueOnce(new Error("offline"));
    const result: any = await fetchOwnedAutographAssets(
        "0x0000000000000000000000000000000000000003"
    );
    expect(result.hasError).toBe(true);
});

test("a lookup that answers 5xx is reported as an error", async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 503 });
    const result: any = await fetchOwnedAutographAssets(
        "0x0000000000000000000000000000000000000004"
    );
    expect(result.hasError).toBe(true);
});
