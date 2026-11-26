import React, { useState } from "react";
import dynamic from "next/dynamic";
import type { TravelAvatar } from "@utils/travelAvatar";

// Loaded the first time a frame asks for it.
const PageAvatarPicker = dynamic(() => import("./PageAvatarPicker"), {
    ssr: false,
});

/**
 * The avatar picker of a page that frames something (./pageAvatar.ts).
 * `open` is what the page does when its frame asks for the picker;
 * `picker` is drawn by the page; `onChosen` tells the frame.
 */
export function usePageAvatarPicker(onChosen: (avatar: TravelAvatar) => void) {
    const [open, setOpen] = useState(false);
    return {
        isOpen: open,
        open: () => setOpen(true),
        close: () => setOpen(false),
        picker: open ? (
            <PageAvatarPicker
                onChosen={onChosen}
                onClose={() => setOpen(false)}
            />
        ) : null,
    };
}
