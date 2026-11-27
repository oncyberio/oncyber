import React, { useState } from "react";
import dynamic from "next/dynamic";
import type { TravelAvatar } from "@utils/travelAvatar";
import { readPickerRequest } from "./pageAvatar";

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
    const [wearing, setWearing] = useState<string>();
    return {
        isOpen: open,
        /** `request` is the frame's `avatar-picker` message, when it has one. */
        open: (request?: unknown) => {
            setWearing(readPickerRequest(request).wearing);
            setOpen(true);
        },
        close: () => setOpen(false),
        picker: open ? (
            <PageAvatarPicker
                wearing={wearing}
                onChosen={onChosen}
                onClose={() => setOpen(false)}
            />
        ) : null,
    };
}
