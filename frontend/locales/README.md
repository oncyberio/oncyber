# Interface languages

The interface speaks English, Spanish, Japanese, Korean and Chinese.
`language.ts` holds the rules; `components/context/I18nContext.tsx` applies
them.

-   **Which language.** `?lang=es` first, then the visitor's saved choice,
    then the first browser language we support, then English. The server
    always renders English and the client switches before the first paint.
-   **Switching.** The language code in the landing header, the language row
    in the account menu, the `/` command menu, and the flags in the in-space
    settings panel.
-   **Keys.** The older in-space strings use `UPPER_SNAKE` keys defined in
    every `*/index.json`. Newer strings use the English text itself as the key
    (`t("My spaces")`), so a missing translation shows the English.
    `{name}` placeholders are filled from the second argument.
-   **Where translations live.** `es/index.json` mirrors `en/index.json`;
    `es/app.json` holds the English-keyed strings.
-   **In components.** Use `const { t } = useCyberTranslation()`. Screens
    that mount after the language is known and never switch while open
    (Studio) can call `tx("...")` without a hook.

`language.test.ts` checks that Spanish covers every older key and keeps
every placeholder.
