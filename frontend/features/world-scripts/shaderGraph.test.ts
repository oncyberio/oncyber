import { cleanShader, SHADER_LIMITS } from "./shaderGraph";

describe("custom shaders as building blocks", () => {
    it("keeps a graph made of known blocks", () => {
        const shader = {
            color: [
                "mix",
                "palette0",
                "#ffcc00",
                ["fbm", ["add", ["mul", "position", 3], "time"]],
            ],
            glow: ["mul", "color", ["pow", "fresnel", 2]],
            offset: ["mul", 0.05, ["sin", "time"]],
        };
        expect(cleanShader(shader)).toMatchObject({
            color: shader.color,
            glow: shader.glow,
        });
    });

    it("refuses shader code, unknown blocks and wrong arity", () => {
        expect(cleanShader({ color: "gl_FragColor = vec4(1.0);" })).toBeNull();
        expect(cleanShader({ color: ["texture", "uv"] })).toBeNull();
        expect(cleanShader({ color: ["mix", "color"] })).toBeNull();
        expect(cleanShader({ color: ["sin", NaN] })).toBeNull();
        expect(cleanShader("void main() {}")).toBeNull();
    });

    it("refuses graphs too big or too deep to bound their cost", () => {
        let deep: any = "time";
        for (let i = 0; i < SHADER_LIMITS.depth + 2; i++) deep = ["sin", deep];
        expect(cleanShader({ color: deep })).toBeNull();
        const wide = (n: number): any =>
            n === 0 ? "time" : ["add", wide(n - 1), wide(n - 1)];
        expect(cleanShader({ color: wide(8) })).toBeNull();
    });
});
