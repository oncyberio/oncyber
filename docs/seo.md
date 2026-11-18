# Search engines and AI assistants

What each kind of page tells a search engine, an AI assistant or a link
preview, where that is built, and how to check it still holds.

Spaces rank on their own names. A space's title is its name and nothing
else; don't add a brand or a suffix to it.

## What each page carries

| Page                                  | Title and description                                 | Canonical                                   | Structured data                                                         | Text in the HTML                                                                                 | Built in                                                                    |
| ------------------------------------- | ----------------------------------------------------- | ------------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------- |
| Home `/`                              | Site title, the landing's own description             | `/`                                         | Organization, WebSite, ItemList of the featured spaces                  | An h1; links to About, Studio, Docs, Privacy (shown on focus); the featured spaces in `noscript` | `components/layouts/headers.tsx`, `pages/landing-carousel.tsx`              |
| Space `/<link>`, `/spaces/<id>`       | The space's name; its description and who it features | Its link, with `?id=` on single-work spaces | WebPage, CreativeWork (works, wall text, visits, dates), BreadcrumbList | Name, creator, description, wall texts, works, artists, the creator's other spaces, portals      | `components/seo/SpaceSeo.tsx`, `utils/spaceSeo.ts`, `utils/spaceContent.ts` |
| Profile `/@name`                      | `@name on oncyber`                                    | `/@name`                                    | ProfilePage                                                             | The creator's public spaces as links                                                             | `components/profile/index.tsx`, `utils/serverside/profileSpaces.ts`         |
| Template `/destinations/<slug>`, mint | The template's name and description                   | Itself                                      | WebPage                                                                 | Name, author, description                                                                        | `components/seo/DestinationSeo.tsx`                                         |
| Docs `/docs/...`                      | The page's own                                        | Itself                                      | TechArticle, or FAQPage for a page with `faq: true`                     | The page                                                                                         | `pages/docs/[[...slug]].tsx`, `features/docs/content.ts`                    |
| `/about`, `/privacy`, `/studio`       | Their own (`utils/siteMeta.ts`)                       | Themselves                                  |                                                                         | The page                                                                                         | `components/layouts/headers.tsx`                                            |
| A link that finds nothing             | `Could not find "…"`                                  | None; `noindex`; status 404                 |                                                                         | The landing, searching for the link's words                                                      | `utils/serverside/notFoundLanding.ts`                                       |

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

## Database reads

Space pages add none: their text comes from the data the page already
loads. The creator's other spaces are read when a space's cached view is
filled (at most once a day, 13 documents). A profile page reads up to 30 of
the creator's spaces, kept ten minutes per server. A link typed with
capitals costs one more lookup, only when it misses.

## Checking a deployment

```sh
pnpm -C frontend check:seo https://www.oncyber.com
pnpm -C frontend check:seo <preview url> --space /frahm-gallery --profile /@6529
```

It fetches each kind of page and fails when one has lost its title,
description, canonical, structured data, h1 or text, when a missing link
stops answering 404, or when `robots.txt`, the sitemap or `llms.txt` break.
Without `--space` it takes three spaces from the deployment's own sitemap.
Run it on the preview before merging a change to any file in the table
above.
