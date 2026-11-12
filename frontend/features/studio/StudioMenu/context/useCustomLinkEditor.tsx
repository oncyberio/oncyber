import exhibit from "@api/exhibit";
import { UserContext } from "@components/context/UserContext";
import { useDebouncedCallback } from "@components/hooks/useDebouncedCallback";
import { useEventCallback } from "@components/hooks/useEventCallback";
import { useCurrentExhibit } from "@features/studio/context/ExhibitContext";
import { analyticsEditSpaceInfo } from "@features/studio/utils";
import { Experience } from "@uitypes/experience";
import { validatePath } from "@utils/rules/url";
import { useState, useContext } from "react";

/** What the copy control beside a space link shows. */
export type LinkState = "copy" | "loading" | "error" | "success";

export function useCustomLinkEditor() {
    //
    const { user } = useContext(UserContext);

    const { exhibitStore, exhibit } = useCurrentExhibit();

    const [customLink, setCustomLink] = useState(exhibit.info.customLink || "");

    const [customLinkStatus, setCustomLinkStatus] = useState<LinkState>("copy");

    const [customLinkError, setCustomLinkError] = useState<string>();

    const copyLink = useEventCallback(() => {
        //

        const link = customLink
            ? `https://oncyber.io/${customLink}`
            : `https://oncyber.io/spaces/${exhibit.id}`;

        navigator.clipboard.writeText(link);

        setCustomLinkStatus("success");

        setTimeout(() => {
            setCustomLinkStatus("copy");
        }, 2000);
        //
    }, []);

    const saveCustumLink = useDebouncedCallback(async (customLink: string) => {
        //
        setCustomLinkError("");

        setCustomLink(customLink);

        try {
            if (customLink.includes("@")) {
                throw new Error("The path can't contain @.");
            }

            if (customLink.includes("/") || customLink.includes("\\")) {
                throw new Error("The path can't contain /.");
            }

            const validPathname = validatePath(customLink);

            if (!validPathname.success)
                throw new Error(
                    "Please enter a valid pathname. e.g. my-cool-exhibit"
                );

            const link = validPathname.value.split("/")[1];

            const data = await exhibitStore.updateCustomLink(link);

            if (data.success === true) {
                //
                analyticsEditSpaceInfo(exhibit, user, ["customLink"]);

                setCustomLinkStatus("success");

                setTimeout(() => {
                    setCustomLinkStatus("copy");
                }, 2000);
            } else {
                throw new Error(data.error);
            }

            //
        } catch (err) {
            //
            setCustomLinkStatus("error");

            setCustomLinkError(err.message);
        }
    }, 2000);

    const handleChange = useEventCallback((_value: string) => {
        //
        try {
            const value = _value
                .toLowerCase()
                .replaceAll("https://oncyber.io", "")
                .replace(/[^a-zA-Z0-9-_]+/, "");

            setCustomLink(value);

            // Disallow invalid URI characters (only A-Z a-z 0-9 - _ . ! ~ * ' ( ) are accepted)
            // cf https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/encodeURIComponent#description
            if (encodeURIComponent(value) !== value) {
                //

                throw new Error("Invalid link");
            }

            setCustomLinkStatus("loading");

            setCustomLinkError("");

            saveCustumLink(value);

            // update link for event

            //
        } catch (err) {
            //
            setCustomLinkStatus("error");

            setCustomLinkError(err.message);
        }
        //
    }, []);

    return {
        customLink,
        customLinkStatus,
        customLinkError,
        copyLink,
        saveCustumLink,
        handleChange,
    };
}
