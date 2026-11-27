/** @jest-environment node */
import { isAutographUser } from "./autographAssets";

const fetchMock = jest.fn(async () => ({ ok: false }));
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
])("%s is not an Autograph user and nothing is asked", async (_n, id) => {
    await expect(isAutographUser(id)).resolves.toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
});

test("an Ethereum wallet is still checked", async () => {
    await isAutographUser("0x0000000000000000000000000000000000000001");
    expect(fetchMock).toHaveBeenCalled();
});
