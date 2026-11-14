# Contributor mode (prototype)

Contributor mode lets a visitor change Oncyber while using it, then send the
change as a pull request. It lives in **Account → Contribute**.

1. The visitor signs in with GitHub (through Firebase Auth, which links
   GitHub to their Oncyber account and hands back a token with the
   `public_repo` scope) and with ChatGPT (the assistant then runs on their
   ChatGPT plan). A pasted GitHub token or OpenAI API key works too.
2. Turning contributor mode on opens a sidebar on every page.
3. They point at something, describe a change, and the assistant finds the
   source on `main`, writes the edit, and previews it on the page.
4. **Open pull request** forks `oncyberio/oncyber` into their account (or
   reuses their fork), commits the kept changes on a new `contrib/…` branch
   and opens a pull request to `main`.

Code: `frontend/features/contribute/`.

## Security choices

-   **Credentials stay with the visitor.** GitHub and ChatGPT tokens (or a
    pasted token and API key) are kept in the browser's local storage and
    used only against `api.github.com` and `api.openai.com`. There is no
    shared Oncyber key. "Forget everything" in settings deletes them. One
    exception: the ChatGPT sign-in code and refresh token go through
    `/api/contribute/chatgpt-token`, which forwards them to OpenAI's token
    endpoint (it can hold a client secret, and OpenAI's token endpoint isn't
    documented for browser calls). It stores and logs nothing. The cost of
    keeping tokens in the browser: anything that can run script on the
    Oncyber origin could read them, so XSS care matters more.
-   **GitHub through Firebase.** Signing in links GitHub to the visitor's
    Oncyber account, so it also becomes a way to sign in to Oncyber. Firebase
    returns the GitHub token once and doesn't keep it.
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
-   Sign in with ChatGPT needs a client ID from OpenAI, which it gives to
    approved apps only ([request one](https://developers.openai.com/siwc/request-client-id)).
    Set `NEXT_PUBLIC_CHATGPT_CLIENT_ID` and register
    `<origin>/contribute/chatgpt-callback` as the redirect for each
    environment. Until then the button is off and visitors use an API key.
    The flow follows OpenAI's docs but hasn't run against the real service.
-   Sign in with GitHub needs the GitHub provider turned on in Firebase Auth
    (a GitHub OAuth app whose callback is the Firebase auth handler). Without
    it, visitors paste a token.
-   The conversation and kept changes reset on a full page reload.
