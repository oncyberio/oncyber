import { removeQueryParam } from "./urlUtils";

describe("removeQueryParam", () => {
    it("leaves the router alone when the parameter is not there", () => {
        const router = { pathname: "/studio", query: {}, replace: jest.fn() };
        removeQueryParam(router, "templateId");
        expect(router.replace).not.toHaveBeenCalled();
    });

    it("drops the parameter and keeps the others, without a reload", () => {
        const router = {
            pathname: "/studio",
            query: { templateId: "loft", tab: "assets" },
            replace: jest.fn(),
        };
        removeQueryParam(router, "templateId");
        expect(router.replace).toHaveBeenCalledWith(
            { pathname: "/studio", query: "tab=assets" },
            undefined,
            { shallow: true }
        );
    });
});
