import { ReactNode, useContext, useEffect, useRef, useState } from "react";
import { MY_SPACES_HREF, SPACE_FILTERS, type SpaceFilter } from "../yourSpaces";
import { useRouter } from "next/router";
import { UserContext } from "@components/context/UserContext";
import { DiscoveryFilters } from "../types";
import { TEMPLATE_CATEGORIES, TemplateCategory } from "../templateSearch";
import {
    Command,
    createCommands,
    feedCommands,
    helpCommands,
} from "../commands";
import useDiscoveryShortcuts from "../hooks/useDiscoveryShortcuts";
import CommandMenu from "./CommandMenu";
import Header from "./Header";
import { useCyberTranslation } from "@components/context/I18nContext";
import { LANGUAGE_NAMES, SUPPORTED_LANGUAGES } from "locales/language";

interface Props {
    immersive?: boolean;
    onHome?: () => void;
    createControl?: ReactNode;
    filters: DiscoveryFilters;
    update: (patch: Partial<DiscoveryFilters>) => void;
    templates?: {
        category: TemplateCategory;
        update: (category: TemplateCategory) => void;
        /** The visitor's own spaces, when Create lists them. */
        spaces?: { filter: SpaceFilter; update: (filter: SpaceFilter) => void };
    };
}

function focusSearch(select = false) {
    const search = document.getElementById(
        "landing-search"
    ) as HTMLInputElement;
    search?.focus();
    if (select) search?.select();
}

export default function DiscoveryHeader({
    filters,
    update,
    templates,
    immersive = false,
    onHome,
    createControl,
}: Props) {
    const router = useRouter();
    const { user, authenticated, isAnonymous } =
        useContext(UserContext) || ({} as any);
    const signedIn = !!(user?.id && authenticated && !isAnonymous);
    const [open, setOpen] = useState(false);
    const [authRequest, setAuthRequest] = useState(0);
    const menuRef = useRef<HTMLDivElement>(null);
    const { i18n, switchI18n } = useCyberTranslation();

    function closeMenu() {
        setOpen(false);
        focusSearch();
    }
    function navigate(patch: (query: Record<string, any>) => void) {
        const next = { ...router.query };
        patch(next);
        void router.push(
            { pathname: router.pathname, query: next },
            undefined,
            {
                shallow: true,
                scroll: false,
            }
        );
    }
    const go = (href: string) => void router.push(href);

    function buildCommands(): Command[] {
        const filters_: Command[] = templates
            ? [
                  ...(templates.spaces
                      ? SPACE_FILTERS.map((filter) => ({
                            id: `spaces-${filter.value}`,
                            section: "Filter your worlds",
                            label: filter.label,
                            icon: "filter" as const,
                            keywords: "filter sort my worlds spaces",
                            checked: templates.spaces.filter === filter.value,
                            run: () => templates.spaces.update(filter.value),
                        }))
                      : []),
                  ...TEMPLATE_CATEGORIES.map((category) => ({
                      id: `filter-${category.value}`,
                      section: "Filter templates",
                      label: category.label,
                      icon: "filter" as const,
                      keywords: "filter category template",
                      checked: templates.category === category.value,
                      run: () => templates.update(category.value),
                  })),
              ]
            : feedCommands(filters.category, update);
        const create = createCommands(
            templates
                ? undefined
                : () =>
                      navigate((query) => {
                          delete query.lobby;
                          query.create = "gallery";
                      })
        );
        const goTo: Command[] = [
            {
                id: "go-lobby",
                section: "Go to",
                label: "Jump into the lobby",
                detail: "Hang out with people live",
                icon: "portal" as const,
                keywords: "jump in multiplayer people world",
                run: () =>
                    navigate((query) => {
                        query.lobby = "1";
                        delete query.create;
                    }),
            },
            templates && {
                id: "go-explore",
                section: "Go to",
                label: "Explore worlds",
                detail: "Back to the world feed",
                icon: "globe" as const,
                keywords: "browse discover home",
                run: () =>
                    navigate((query) => {
                        if (router.pathname.startsWith("/studio/new-"))
                            query.create = "explore";
                        else delete query.create;
                    }),
            },
            {
                id: "go-search",
                section: "Go to",
                label: templates ? "Search spaces" : "Search worlds",
                detail: "Worlds, artists, creators",
                icon: "search" as const,
                hint: "⌘K",
                keywords: "find",
                keepFocus: true,
                run: () => focusSearch(true),
            },
            signedIn && {
                id: "go-spaces",
                section: "Go to",
                label: "My spaces",
                icon: "gallery" as const,
                keywords: "worlds account",
                run: () => go(MY_SPACES_HREF),
            },
            signedIn && {
                id: "go-destinations",
                section: "Go to",
                label: "My destinations",
                icon: "folder" as const,
                keywords: "account manage",
                run: () => go("/destinations"),
            },
            !signedIn && {
                id: "sign-in",
                section: "Go to",
                label: "Sign in",
                detail: "Wallet or email",
                icon: "signin" as const,
                keywords: "login account connect wallet",
                keepFocus: true,
                run: () => setAuthRequest((count) => count + 1),
            },
        ].filter(Boolean) as Command[];
        const languages: Command[] = SUPPORTED_LANGUAGES.map((language) => ({
            id: `language-${language}`,
            section: "Language",
            label: LANGUAGE_NAMES[language],
            icon: "globe" as const,
            keywords: `language idioma ${language}`,
            checked: i18n === language,
            run: () => switchI18n(language),
        }));
        return [
            ...filters_,
            ...create,
            ...goTo,
            ...helpCommands(go),
            ...languages,
        ];
    }

    useDiscoveryShortcuts({
        enabled: !immersive,
        onSearch: () => {
            setOpen(false);
            focusSearch(true);
        },
        onMenu: () => setOpen(true),
    });

    useEffect(() => {
        if (immersive) {
            setOpen(false);
            return;
        }
        function outside(event: PointerEvent | FocusEvent) {
            if (!menuRef.current?.contains(event.target as Node))
                setOpen(false);
        }
        document.addEventListener("pointerdown", outside);
        document.addEventListener("focusin", outside);
        return () => {
            document.removeEventListener("pointerdown", outside);
            document.removeEventListener("focusin", outside);
        };
    }, [immersive]);

    return (
        <>
            <Header
                immersive={immersive}
                onHome={onHome}
                menu={createControl}
                search={null}
                authRequest={authRequest}
            />
            {!immersive && open && (
                <CommandMenu
                    ref={menuRef}
                    commands={buildCommands()}
                    listLabel={
                        templates ? "Template categories" : "World feeds"
                    }
                    onClose={closeMenu}
                    onRun={(command) => {
                        setOpen(false);
                        if (!command.keepFocus) focusSearch();
                    }}
                />
            )}
        </>
    );
}
