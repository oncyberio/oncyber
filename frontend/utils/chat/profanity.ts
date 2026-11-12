// Words masked in space chat. Chat builds one case-insensitive pattern from
// this list and matches inside words, so keep entries long and specific
// enough not to hit ordinary words (no "ass", which is in "class").
export const PROFANITY: readonly string[] = [
    "asshole",
    "bitch",
    "bullshit",
    "cocksucker",
    "cunt",
    "dickhead",
    "faggot",
    "fuck",
    "motherfucker",
    "nigga",
    "nigger",
    "retard",
    "shit",
    "slut",
    "twat",
    "wanker",
    "whore",
];
