# Search engines and AI assistants

What each kind of page tells a search engine, an AI assistant or a link
preview, where that is built, and how to check it still holds.

Spaces rank on their own names. A space's title is its name and nothing
else; don't add a brand or a suffix to it.

## What each page carries

| Page                                  | Title and description                                 | Canonical                                   | Structured data                                                         | Text in the HTML                                                                                    | Built in                                                                                             |
| ------------------------------------- | ----------------------------------------------------- | ------------------------------------------- | ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Home `/`                              | Site title, the landing's own description             | `/`                                         | Organization, WebSite, ItemList of the featured spaces                  | An h1; the featured spaces in `noscript`                                                            | `components/layouts/headers.tsx`, `pages/landing-carousel.tsx`                                       |
| Space `/<link>`, `/spaces/<id>`       | The space's name; its description and who it features | Its link, with `?id=` on single-work spaces | WebPage, CreativeWork (works, wall text, visits, dates), BreadcrumbList | Name, creator, description, wall texts, works, artists, the creator's other spaces, portals         | `components/seo/SpaceSeo.tsx`, `utils/spaceSeo.ts`, `utils/spaceContent.ts`                          |
| Template `/destinations/<slug>`, mint | The template's name and description                   | Itself                                      | WebPage                                                                 | Name, author, description                                                                           | `components/seo/DestinationSeo.tsx`                                                                  |
| Docs `/docs/...`                      | The page's own                                        | Itself                                      | TechArticle, or FAQPage for a page with `faq: true`                     | The page                                                                                            | `pages/docs/[[...slug]].tsx`, `features/docs/content.ts`                                             |
| About `/about`                        | Its own (`utils/siteMeta.ts`)                         | Itself                                      | AboutPage and FAQPage, one question per section of `content/about.md`   | The page: what Oncyber is, the questions and answers, community, social, source-code and docs links | `pages/about.tsx`, `features/docs/content.ts`                                                        |
| Profile link `/@name`                 | `@name on oncyber`; who they are and how many spaces  | `/@name`; a wallet link redirects to it     | ProfilePage, with the person's spaces                                   | The lobby with the person's panel open; an h1 and links to their public spaces                      | `components/seo/ProfileSeo.tsx`, `utils/profileSeo.ts`, `utils/serverside/landingServerSideProps.ts` |
| `/privacy`, `/studio`                 | Their own (`utils/siteMeta.ts`)                       | Themselves                                  |                                                                         | The page                                                                                            | `components/layouts/headers.tsx`                                                                     |
| A link that finds nothing             | `Could not find "…"`                                  | None; `noindex`; status 404                 |                                                                         | The landing, searching for the link's words                                                         | `utils/serverside/notFoundLanding.ts`                                                                |

Every address in a canonical, `og:url`, the sitemap and structured data is
on the search origin (`NEXT_PUBLIC_SEARCH_ORIGIN`, see `utils/siteUrl.ts`).

A space is drawn on a canvas, so its text is in a section that is rendered
on the server, visually hidden and out of the tab order. It says what the
space info sidebar shows: nothing goes there that a visitor cannot find in
the space.

## Files for crawlers

| Address           | What it is                                                                                | Built in                                 |
| ----------------- | ----------------------------------------------------------------------------------------- | ---------------------------------------- |
| `/robots.txt`     | Who may crawl what. AI search engines and assistants are named and let in.                | `public/robots.txt`, `middleware.ts`     |
| `/sitemap.xml`    | An index of 62 parts by space id, plus the site's pages. Each space with its cover image. | `utils/sitemap.ts`, `pages/api/sitemap/` |
| `/llms.txt`       | The product, the featured spaces and the docs, as plain text for AI assistants            | `features/docs/content.ts`               |
| `/llms-full.txt`  | Every docs page in one file                                                               | `features/docs/content.ts`               |
| `/docs/<page>.md` | A docs page as Markdown                                                                   | `pages/api/docs/raw.ts`                  |

The sitemap lists a space only when it is public and has a name. A space
with a link but no name shows a title like "0x2b4's Untitled x1", and about
one listed address in twelve was one of those (measured on a sample of 160
in November 2026). Such a space still opens, and its page is headed by its
creator's name ("@name's space"), but it is not put forward to crawlers.

`/discover`, the old "Live worlds" list, redirects to the home page like
`/explore`: it shared the home page's title and no longer loaded its cards.

The home page's title in a browser tab and a search result is "oncyber: open
metaverse for the creative ones" (`HOME_TITLE`). Its link-preview card keeps
"oncyber: forever" (`SITE_TITLE`), the words on the card's picture.

## What the November 2026 audit found

A Semrush crawl of oncyber.io and of this site, and its link and keyword
data, before the move to oncyber.com:

-   **Links to keep.** 590 oncyber.io addresses with links pointing at them
    or with search traffic were requested on www.oncyber.com. 573 answer,
    and the 17 that do not are already gone on oncyber.io. Nothing with
    links is lost by the move as long as every oncyber.io path keeps
    redirecting to the same path here.
-   **Subdomains are outside this app.** `docs.oncyber.io` (the game-making
    reference, about 500 pages), `v2.oncyber.io` and `oo.oncyber.io` have
    links of their own. Their paths do not exist under `/docs` here, so
    they need their own hosting or redirects when the domain moves.
-   **Many of the old domain's links are not earned.** oncyber.io has about
    7,800 linking domains. The four most-linked spaces have 1,500 to 2,200
    each, and the commonest anchor texts on the domain are adverts for paid
    links ("premium seo backlinks…") naming those spaces' own domains. The
    home page has about 1,000 linking domains; those are the ones to keep.
-   **What people search for.** "virtual art gallery" (390 a month in the
    US, easy), "virtual showroom" (390), "virtual exhibition platform"
    (170), "online exhibition" (140) and "3d art gallery" (90) are the
    searches this product answers. The About page now answers the first
    four in its questions.

## Database reads

Space pages add none: their text comes from the data the page already
loads. The creator's other spaces are read when a space's cached view is
filled (at most once a day, 13 documents). A link typed with
capitals costs one more lookup, only when it misses.

A profile link reads the person and up to 30 of their spaces, kept in
memory for ten minutes. When the accounts cannot be read, the link
answers 503 with `Retry-After`, never 404: the person is not gone. `next.config.js` serves `/@name` as the lobby
(`/?lobby=1&profile=name`); a name nobody has answers 404 like any other
missing link. Closing the panel leaves the lobby at `/?lobby=1`, whose
canonical is the home page.

## What a gated or hidden space shows

A visitor the gate turns away (password, token, invitation) gets the
space's name, creator and own description, and none of what is inside or
how it is used: no works, wall texts, portals, sibling links, template
name, visit count or dates, in the HTML or the structured data. Search
engines and assistants are such visitors. The cover the owner chose still
previews the link, as it always has.

Links to a creator's other spaces are read ahead of time, so a space made
private or unlisted can stay listed for a while: up to ten minutes on its
creator's profile link, and up to a day on the pages of their other spaces
(until each page's cached view is next filled).

The about page is written in `frontend/content/about.md`. Each `##`
heading that ends in a question mark becomes a question on the page, in
its structured data and in `llms-full.txt`, so edit the answers there.

## Checking a deployment

```sh
pnpm -C frontend check:seo https://www.oncyber.com
pnpm -C frontend check:seo <preview url> --space /frahm-gallery --profile /@6529
```

It fetches each kind of page and fails when one has lost what that kind
carries: every page its title, one description and its canonical; spaces,
profiles, the home page, docs and the about page their structured data;
spaces and profiles their h1 and text. A canonical has to be on the
deployment being checked or on a production domain. It also fails when a
missing link stops answering 404, when `robots.txt`, the sitemap or
`llms.txt` break, and when a page of the production site answers
`X-Robots-Tag: noindex` (previews are expected to, on every page). Without
`--space` it takes three spaces from the first part of the deployment's
own sitemap that lists any, and fails when none does. A profile is checked
only when one is named with `--profile`.

Run it on the preview before merging a change to any file in the table
above.
