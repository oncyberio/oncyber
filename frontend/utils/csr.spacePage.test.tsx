/** @jest-environment jsdom */
// The world page (pages/spaces/[id].tsx) warms portal previews only once the
// world is showing, never at mount.
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { preloadExhibitPortalData } from "@utils/csr";
import Space from "../pages/spaces/[id]";

const mockGate = { props: null as any };

jest.mock("@components/context/UserContext", () => ({
    UserContext: require("react").createContext({
        isAnonInitialized: true,
        user: null,
    }),
}));
jest.mock(
    "@3/displyUI/Exhibit3DGate",
    () => (props) => {
        mockGate.props = props;
        return null;
    },
    { virtual: true }
);
jest.mock(
    "@api/notifications/_api",
    () => ({
        __esModule: true,
        default: { sendVisitNotification: jest.fn() },
    }),
    { virtual: true }
);
jest.mock("@utils/csr", () => ({ preloadExhibitPortalData: jest.fn() }));
jest.mock("next/dynamic", () => () => () => null);
jest.mock("next/head", () => () => null);
jest.mock("next/router", () => ({
    useRouter: () => ({ pathname: "/spaces/[id]" }),
}));
jest.mock("../utils/authServerSideProps", () => ({
    AuthServerSidePropsLite: (fn) => fn,
}));
jest.mock("../utils/rooms", () => ({ rooms: {} }));
jest.mock("../utils/analytics", () => ({
    amplitude_logAnalyticsEvent: jest.fn(),
    getCookie: jest.fn(),
}));
jest.mock("../utils/ssr", () => ({ fetchExhibitData: jest.fn() }));
jest.mock("../utils/checkGatingRules", () => ({ checkGating: jest.fn() }));
jest.mock("@utils/urlUtils", () => ({
    cloudinary: { artworkMissingUpload: () => false },
}));
jest.mock("@components/context/GatingErrorContext", () => ({
    GatingErrorProvider: ({ children }) => children,
}));
jest.mock("@utils/js", () => ({ getJSON: jest.fn() }));

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const experience = {
    id: "hub",
    owner: "0xowner",
    editors: ["0xowner"],
    info: { headline: "Hub", room: "room" },
    artworks: {},
    portals: { a: { exhibitId: "a" } },
    portalExhibits: {},
} as any;

test("portal previews start when the world is showing, once", async () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    await act(async () => {
        root.render(
            <Space
                experience={experience}
                dest={{ slug: "room" } as any}
                getExhibitPath={null}
            />
        );
    });

    expect(preloadExhibitPortalData).not.toHaveBeenCalled();
    expect(typeof mockGate.props.onWorldRendered).toBe("function");

    await act(async () => mockGate.props.onWorldRendered({ slug: "room" }));
    // A portal trip renders another world in the same page: no second warm-up.
    await act(async () => mockGate.props.onWorldRendered({ slug: "other" }));

    expect(preloadExhibitPortalData).toHaveBeenCalledTimes(1);
    const [world, signal] = (preloadExhibitPortalData as jest.Mock).mock
        .calls[0];
    expect(world).toBe(experience);
    expect(signal.aborted).toBe(false);

    await act(async () => root.unmount());
    expect(signal.aborted).toBe(true);
});
