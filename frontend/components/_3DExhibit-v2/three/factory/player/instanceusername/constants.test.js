jest.mock("@3constants", () => ({ IS_MOBILE: false }), { virtual: true })

import { CANVAS_SIZE, ATLAS_SIZE } from "./constants"

describe("name tag sizes", () => {

    it("draws tags at 4x on desktop so they stay sharp up close", () => {

        expect(CANVAS_SIZE.w).toBe(1024)
        expect(CANVAS_SIZE.h).toBe(200)
        expect(CANVAS_SIZE.fontSize).toBe(108)
    })

    it("keeps room for 20 tags in the atlas, as before", () => {

        const perRow = Math.floor(ATLAS_SIZE / CANVAS_SIZE.w)
        const rows = Math.floor(ATLAS_SIZE / CANVAS_SIZE.h)

        expect(perRow * rows).toBe(20)
    })

    it("keeps the tag's shape", () => {

        expect(CANVAS_SIZE.aspect).toBeCloseTo(256 / 50)
    })
})
