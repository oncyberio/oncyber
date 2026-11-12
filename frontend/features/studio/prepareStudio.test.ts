import { prepareStudio } from "./prepareStudio";
import { prepareNavigation } from "@utils/navigationSaves";
import { startAnonExhibit } from "@utils/anon";
import { getDestination } from "@utils/saveToDb";

jest.mock("@utils/navigationSaves", () => ({ prepareNavigation: jest.fn() }));
jest.mock("@utils/anon", () => ({ startAnonExhibit: jest.fn() }));
jest.mock("@utils/saveToDb", () => ({ getDestination: jest.fn() }));

const exhibit = { id: "new", info: { room: "cyberwarehouse" } } as any;
const navigation = prepareNavigation as jest.Mock;
const sign = startAnonExhibit as jest.Mock;
const destination = getDestination as jest.Mock;
const tick = async () => {
    for (let i = 0; i < 8; i++) await Promise.resolve();
};

beforeEach(() => {
    jest.resetAllMocks();
    navigation.mockResolvedValue(undefined);
    sign.mockResolvedValue(undefined);
    destination.mockResolvedValue({ slug: "cyberwarehouse" });
});

test("loads the room while saving, but never replaces a draft before pending saves finish", async () => {
    let finishSave, finishRoom, finishSign;
    navigation.mockImplementation(
        () =>
            new Promise((resolve) => {
                finishSave = resolve;
            })
    );
    destination.mockImplementation(
        () =>
            new Promise((resolve) => {
                finishRoom = resolve;
            })
    );
    sign.mockImplementation(
        () =>
            new Promise((resolve) => {
                finishSign = resolve;
            })
    );
    let ready = false;
    const work = prepareStudio(exhibit, true).then(() => {
        ready = true;
    });
    expect(destination).toHaveBeenCalledWith("cyberwarehouse");
    expect(navigation).toHaveBeenCalledTimes(1);
    expect(sign).not.toHaveBeenCalled();
    finishSave();
    await tick();
    expect(sign).toHaveBeenCalledWith(exhibit);
    finishRoom({ slug: "cyberwarehouse" });
    await tick();
    expect(ready).toBe(false);
    finishSign();
    await work;
    expect(ready).toBe(true);
});

test("save failure prevents draft replacement and rejects navigation", async () => {
    navigation.mockRejectedValue(new Error("Save failed"));
    await expect(prepareStudio(exhibit, true)).rejects.toThrow("Save failed");
    expect(sign).not.toHaveBeenCalled();
});

test("signing failure is still surfaced", async () => {
    sign.mockRejectedValue(new Error("Signing failed"));
    await expect(prepareStudio(exhibit, true)).rejects.toThrow(
        "Signing failed"
    );
});

test("signed-in navigation preserves save guards without touching the guest draft", async () => {
    await prepareStudio(exhibit, false);
    expect(navigation).toHaveBeenCalledTimes(1);
    expect(sign).not.toHaveBeenCalled();
    expect(destination).not.toHaveBeenCalled();
});
