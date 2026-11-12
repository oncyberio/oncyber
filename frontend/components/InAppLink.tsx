import React, { AnchorHTMLAttributes, forwardRef, useRef } from "react";
import { useRouter } from "next/router";
import { prepareNavigation } from "@utils/navigationSaves";
import { showError } from "@components/Dialogs";
import { beginSpaceEntrance, SpaceEntrance } from "@utils/spaceEntrance";

type Props = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
    href: string;
    spaceEntrance?: SpaceEntrance;
    replace?: boolean;
    scroll?: boolean;
    shallow?: boolean;
    legacyBehavior?: boolean;
    passHref?: boolean;
    prefetch?: boolean;
};

/** Pages-router navigation only on activation, never on visibility/hover/touch. */
const InAppLink = forwardRef<HTMLAnchorElement, Props>(function InAppLink(
    {
        href,
        spaceEntrance,
        replace = false,
        scroll = true,
        shallow = false,
        legacyBehavior,
        passHref,
        prefetch,
        children,
        onClick,
        ...props
    },
    ref
) {
    const router = useRouter();
    const navigating = useRef(false);
    const child = legacyBehavior
        ? (React.Children.only(children) as React.ReactElement<any>)
        : null;
    const activate = (event: React.MouseEvent<HTMLAnchorElement>) => {
        onClick?.(event);
        if (child && child.props && typeof child.props.onClick === "function") {
            child.props.onClick(event);
        }
        const anchor = event.currentTarget;
        if (
            event.defaultPrevented ||
            event.button !== 0 ||
            event.metaKey ||
            event.ctrlKey ||
            event.shiftKey ||
            event.altKey ||
            (anchor.target && anchor.target !== "_self") ||
            anchor.hasAttribute("download")
        )
            return;
        const url = new URL(anchor.href, window.location.href);
        if (url.origin !== window.location.origin) return;
        event.preventDefault();
        // A second activation must not cancel the route already loading.
        if (navigating.current) return;
        navigating.current = true;
        const sourcePath = router.asPath;
        let cancelled = false;
        const entrance = spaceEntrance
            ? beginSpaceEntrance(anchor, spaceEntrance, () => {
                  cancelled = true;
                  void router
                      .replace(sourcePath, undefined, {
                          shallow: true,
                          scroll: false,
                      })
                      .catch(() => {});
              })
            : undefined;
        const popstate = () => {
            cancelled = true;
        };
        window.addEventListener("popstate", popstate);
        void prepareNavigation()
            .then(() =>
                cancelled
                    ? false
                    : router[replace ? "replace" : "push"](href, undefined, {
                          scroll,
                          shallow,
                      })
            )
            .then((completed) => {
                // Next returns false when another navigation wins. It is not a load error.
                if (!completed) entrance?.cancel();
            })
            .catch((error) => {
                entrance?.cancel();
                if (!cancelled && !error?.cancelled) {
                    console.error("Navigation failed", error);
                    showError(
                        error.message || "Please try again.",
                        "Could not open this page"
                    );
                }
            })
            .finally(() => {
                navigating.current = false;
                window.removeEventListener("popstate", popstate);
            });
    };
    return child ? (
        React.cloneElement(child, {
            ...props,
            href,
            onClick: activate,
            ...(ref ? { ref } : {}),
        })
    ) : (
        <a {...props} ref={ref} href={href} onClick={activate}>
            {children}
        </a>
    );
});
export default InAppLink;
