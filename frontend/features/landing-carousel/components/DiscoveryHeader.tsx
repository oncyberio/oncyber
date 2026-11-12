import { ReactNode, useContext, useEffect, useRef, useState } from "react";
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

interface Props {
    immersive?: boolean;
    onHome?: () => void;
    createControl?: ReactNode;
    filters: DiscoveryFilters;
    update: (patch: Partial<DiscoveryFilters>) => void;
    templates?: {
        category: TemplateCategory;
        update: (category: TemplateCategory) => void;
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
    const { user, userData, authenticated, isAnonymous } =
        useContext(UserContext) || ({} as any);
    const signedIn = !!(user?.id && authenticated && !isAnonymous);
    const username = userData?.username?.replace(/^@/, "");
    const [open, setOpen] = useState(false);
    const [authRequest, setAuthRequest] = useState(0);
    const menuRef = useRef<HTMLDivElement>(null);

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
            ? TEMPLATE_CATEGORIES.map((category) => ({
                  id: `filter-${category.value}`,
                  section: "Filter templates",
                  label: category.label,
                  icon: "filter" as const,
                  keywords: "filter category template",
                  checked: templates.category === category.value,
                  run: () => templates.update(category.value),
              }))
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
                id: "go-profile",
                section: "Go to",
                label: "My spaces",
                detail: username ? `@${username}` : undefined,
                icon: "user" as const,
                keywords: "profile account",
                run: () =>
                    go(`/@${encodeURIComponent(username || user?.id || "")}`),
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
        return [...filters_, ...create, ...goTo, ...helpCommands(go)];
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
