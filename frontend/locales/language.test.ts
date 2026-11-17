import { matchLanguage, pickLanguage, translate } from "./language";
import en from "./en/index.json";
import es from "./es/index.json";
import esApp from "./es/app.json";

test("browser tags map to their base language", () => {
    expect(matchLanguage("es-MX")).toBe("es");
    expect(matchLanguage("es_419")).toBe("es");
    expect(matchLanguage("zh-Hant-TW")).toBe("zh");
    expect(matchLanguage("pt-BR")).toBeNull();
    expect(matchLanguage(undefined)).toBeNull();
});

test("?lang wins, then the saved choice, then the browser, then English", () => {
    const browser = ["pt-BR", "es-AR", "en-US"];
    expect(pickLanguage({ query: "ja", stored: "en", browser })).toBe("ja");
    expect(pickLanguage({ query: "xx", stored: "en", browser })).toBe("en");
    expect(pickLanguage({ stored: "ko", browser })).toBe("ko");
    expect(pickLanguage({ stored: "bogus", browser })).toBe("es");
    expect(pickLanguage({ browser: ["fr-FR"] })).toBe("en");
    expect(pickLanguage({})).toBe("en");
});

test("translation falls back to English, then to the key, and fills values", () => {
    expect(translate("es", "SETTINGS")).toBe("Ajustes");
    expect(translate("ja", "My spaces")).toBe("My spaces");
    expect(translate("es", "My spaces")).toBe("Mis espacios");
    expect(translate("es", "Use {name} template", { name: "Loft" })).toBe(
        "Usar la plantilla Loft"
    );
    expect(translate("en", "{count} visits", { count: 3 })).toBe("3 visits");
    expect(translate("es", undefined)).toBeUndefined();
    expect(translate("es", "constructor")).toBe("constructor");
});

test("Spanish covers every older key and keeps every placeholder", () => {
    expect(Object.keys(es).sort()).toEqual(Object.keys(en).sort());
    for (const [key, text] of Object.entries(esApp)) {
        const wanted = (key.match(/\{\w+\}/g) || []).sort();
        expect([key, (text.match(/\{\w+\}/g) || []).sort()]).toEqual([
            key,
            wanted,
        ]);
    }
});
