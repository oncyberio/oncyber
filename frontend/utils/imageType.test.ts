import { gatewayCanResize, sniffImageType } from "./imageType";

const bytes = (...values: (number | string)[]) =>
    new Uint8Array(
        values.flatMap((value) =>
            typeof value === "string"
                ? [...value].map((char) => char.charCodeAt(0))
                : [value]
        )
    );

describe("sniffImageType", () => {
    it("reads the format from the file, not its name", () => {
        expect(sniffImageType(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe("jpeg");
        expect(sniffImageType(bytes(0x89, "PNG", 0x0d, 0x0a))).toBe("png");
        expect(sniffImageType(bytes("GIF89a"))).toBe("gif");
        expect(sniffImageType(bytes("RIFF", 0, 0, 0, 0, "WEBPVP8 "))).toBe(
            "webp"
        );
        // The first bytes of the profile picture that the resizer refused.
        expect(
            sniffImageType(bytes(0, 0, 0, 0x1c, "ftypavif", 0, 0, 0, 0))
        ).toBe("avif");
        expect(sniffImageType(bytes(0, 0, 0, 0x18, "ftypheic"))).toBe("heic");
        expect(sniffImageType(bytes("<svg xmlns"))).toBeNull();
        expect(sniffImageType(new ArrayBuffer(0))).toBeNull();
    });

    it("only asks the gateway to resize what it can", () => {
        expect(gatewayCanResize("jpeg")).toBe(true);
        expect(gatewayCanResize("webp")).toBe(true);
        expect(gatewayCanResize("avif")).toBe(false);
        expect(gatewayCanResize(null)).toBe(false);
    });
});
