/** @jest-environment node */
// Pages under pages/dev are internal test pages. Each must answer "not
// found" outside development. (This test lives outside pages/ because Next
// would build a test file there as a page.)
import { readdirSync, readFileSync } from "fs";
import path from "path";

jest.mock("@features/lobby/LobbyChat", () => ({
    __esModule: true,
    default: () => null,
    ConversationSocial: {},
}));
jest.mock("@features/lobby/LobbyConversationSurface", () => ({
    __esModule: true,
    default: () => null,
}));
jest.mock("@features/lobby/conversationStyles", () => ({
    conversationStyles: "",
}));
jest.mock("@styles/brand", () => ({ brandFoundation: "" }));

const DEV = path.join(__dirname, "..", "pages", "dev");
const GATE =
    /export function getServerSideProps\(\) \{\s*return process\.env\.NODE_ENV === "development"\s*\? \{ props: \{\} \}\s*: \{ notFound: true \};\s*\}/;

const pages = readdirSync(DEV).filter(
    (file) => /\.(tsx?|jsx?)$/.test(file) && !/\.test\./.test(file)
);

test.each(pages)("pages/dev/%s is not found outside development", (file) => {
    expect(readFileSync(path.join(DEV, file), "utf8")).toMatch(GATE);
});

describe("pages/dev/lobby-chat", () => {
    const env = process.env as Record<string, string>;
    const previous = env.NODE_ENV;
    afterEach(() => {
        env.NODE_ENV = previous;
    });

    test.each(["production", "test"])("is not found in %s", (mode) => {
        env.NODE_ENV = mode;
        const { getServerSideProps } = require("../pages/dev/lobby-chat");
        expect(getServerSideProps()).toEqual({ notFound: true });
    });

    test("renders in development", () => {
        env.NODE_ENV = "development";
        const { getServerSideProps } = require("../pages/dev/lobby-chat");
        expect(getServerSideProps()).toEqual({ props: {} });
    });
});
