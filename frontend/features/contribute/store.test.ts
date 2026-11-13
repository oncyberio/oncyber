/** @jest-environment jsdom */
import {
    clearContributeSettings,
    readContributeSettings,
    resetContributeCache,
    writeContributeSettings,
} from "./store";

describe("contributor settings", () => {
    beforeEach(() => {
        localStorage.clear();
        resetContributeCache();
    });

    it("needs both accounts before contributor mode stays on", () => {
        writeContributeSettings({ githubToken: "g", enabled: true });
        expect(readContributeSettings().enabled).toBeUndefined();
        writeContributeSettings({ aiKey: "k", enabled: true });
        expect(readContributeSettings()).toMatchObject({ enabled: true });
        writeContributeSettings({ aiKey: undefined });
        expect(readContributeSettings().enabled).toBeUndefined();
    });

    it("persists in this browser only and can be forgotten", () => {
        writeContributeSettings({ githubToken: "g" });
        resetContributeCache();
        expect(readContributeSettings().githubToken).toBe("g");
        clearContributeSettings();
        expect(localStorage.length).toBe(0);
    });
});
