import { useEffect, useState } from "react";
import {
    readWorldFile,
    readWorldLink,
    type WorldFile,
    type WorldLink,
} from "./worldLinks";

/** How long the page offers a link or a file the world asked for. */
export const OFFER_MS = 15_000;

/** The page's question to the visitor, as the shell's notice shows it. */
export interface WorldOffer {
    message: string;
    actionLabel: string;
    onRetry(): void;
}

/**
 * What a world asks the page to do on its visitor's own click: open a link
 * in a new tab, or save a file it made (a photo). A frame can do neither,
 * and the page does neither on the world's word: it says what is asked and
 * waits for the click. One offer at a time: the newest ask is the one on
 * offer, and it goes away by itself.
 */
export function useWorldOffers() {
    const [link, setLink] = useState<WorldLink | null>(null);
    const [file, setFile] = useState<WorldFile | null>(null);
    useEffect(() => {
        if (!link && !file) return;
        const timer = setTimeout(() => {
            setLink(null);
            setFile(null);
        }, OFFER_MS);
        return () => clearTimeout(timer);
    }, [link, file]);

    const offer: WorldOffer | undefined = link
        ? {
              message: `Open ${link.host} in a new tab?`,
              actionLabel: "Open link",
              onRetry: () => {
                  window.open(link.href, "_blank", "noopener,noreferrer");
                  setLink(null);
              },
          }
        : file
        ? {
              message: `Save ${file.name}?`,
              actionLabel: "Save",
              onRetry: () => {
                  const address = URL.createObjectURL(file.file);
                  const anchor = document.createElement("a");
                  anchor.href = address;
                  anchor.download = file.name;
                  anchor.click();
                  setTimeout(() => URL.revokeObjectURL(address), 10_000);
                  setFile(null);
              },
          }
        : undefined;

    return {
        offer,
        /** What is not a web address is not offered, and takes no offer away. */
        offerLink(href: unknown) {
            const next = readWorldLink(href, window.location.origin);
            if (!next) return;
            setFile(null);
            setLink(next);
        },
        offerFile(message: unknown) {
            const next = readWorldFile(message);
            if (!next) return;
            setLink(null);
            setFile(next);
        },
        clear() {
            setLink(null);
            setFile(null);
        },
    };
}
