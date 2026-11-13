# Contributor mode (prototype)

Contributor mode lets a visitor change Oncyber while using it, then send the
change as a pull request. It lives in **Account → Contribute**.

1. The visitor connects their own GitHub account (a token with the
   `public_repo` scope) and their own OpenAI API key.
2. Turning contributor mode on opens a sidebar on every page.
3. They point at something, describe a change, and the assistant finds the
   source on `main`, writes the edit, and previews it on the page.
4. **Open pull request** forks `oncyberio/oncyber` into their account (or
   reuses their fork), commits the kept changes on a new `contrib/…` branch
   and opens a pull request to `main`.

Code: `frontend/features/contribute/`.

## Security choices

-   **Credentials stay with the visitor.** The token and key are kept in the
    browser's local storage and sent only to `api.github.com` and
    `api.openai.com`, never to Oncyber's servers. There is no shared Oncyber
    key. "Forget everything" in settings deletes them. The cost: anything that
    can run script on the Oncyber origin could read them, so the usual XSS
    care matters more on pages where contributor mode runs.
-   **Previews are data, not code.** The assistant's live preview is CSS plus a
    small set of DOM operations (text, a few safe attributes, inline style,
    hide). Nothing it writes runs as JavaScript, so a model misled by file
    contents can't read the visitor's token. The preview exists only in that
    visitor's tab and is gone on reload.
-   **Pull requests always come from a fork.** Even maintainers go through
    their fork, and the only writes to `oncyberio/oncyber` are the fork request
    and the pull request. Edits under `.github/` are refused, so a proposed
    change can't touch workflows.
-   **Review is still the gate.** A pull request from contributor mode is like
    any outside pull request: CI runs, a maintainer reviews it.

## Limits of the prototype

-   The preview approximates the change on the page as built; the real source
    edit only runs once the pull request is built. Behaviour changes (new
    logic) don't preview.
-   "Sign in with ChatGPT" isn't available to other sites, so the AI side uses
    an OpenAI API key billed to the visitor. Providers are pluggable
    (`providers` in `assistant.ts`).
-   GitHub sign-in is a pasted token. A "Sign in with GitHub" button would need
    an OAuth app (device flow) and a small proxy route, since GitHub's login
    endpoints don't allow browser calls.
-   The conversation and kept changes reset on a full page reload.
