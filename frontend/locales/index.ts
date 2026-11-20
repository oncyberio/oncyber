import en from "./en/index.json";
import es from "./es/index.json";
import esApp from "./es/app.json";
import ja from "./ja/index.json";
import ko from "./ko/index.json";
import zh from "./zh/index.json";

// es/app.json holds the newer strings keyed by their English text
// (see language.ts); only Spanish translates those so far.
export default {
    en,
    es: { ...es, ...esApp },
    ja,
    ko,
    zh,
};
