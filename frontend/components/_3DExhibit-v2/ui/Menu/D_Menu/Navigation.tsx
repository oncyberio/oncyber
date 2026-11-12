import ExperienceShell from "@features/content-host/ExperienceShell";
import { useRouter } from "next/router";
import { useCyberTranslation } from "@components/context/I18nContext";
import { useMultiplayer } from "@components/_3DExhibit-v2/context/MultiplayerProvider";

/** Space details live in the title's info sidebar (ExperienceShell spaceId). */
export default function Navigation({ exhibit, isHidden }) {
    const { t } = useCyberTranslation();

    const { onConnect } = useMultiplayer();

    return (
        <EntryNavigation
            headline={exhibit?.info?.headline || t`UNTITLED`}
            spaceId={exhibit?.id}
            isHidden={isHidden}
            onLogin={onConnect}
        />
    );
}

/** Entry uses the same trusted header and controls as every other runtime. */
export function EntryNavigation({
    headline,
    isHidden = false,
    onLogin,
    spaceId = undefined,
}) {
    const router = useRouter();
    if (isHidden) return null;
    return (
        <ExperienceShell
            title={headline || "Untitled world"}
            spaceId={spaceId}
            onExit={() => void router.push("/")}
            onConnected={onLogin}
        />
    );
}
