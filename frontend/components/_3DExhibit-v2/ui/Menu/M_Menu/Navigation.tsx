import ExperienceShell from "@features/content-host/ExperienceShell";
import { useCurrentExhibit } from "@features/studio/context/ExhibitContext";
import { useRouter } from "next/router";
import { useMultiplayer } from "@components/_3DExhibit-v2/context/MultiplayerProvider";

export default function Navigation({ isHidden }) {
    const router = useRouter();
    const { exhibit } = useCurrentExhibit();
    const { onConnect } = useMultiplayer();
    if (isHidden) return null;
    return (
        <ExperienceShell
            title={exhibit?.info?.headline || "Untitled world"}
            spaceId={exhibit?.id}
            onExit={() => void router.push("/")}
            onConnected={onConnect}
        />
    );
}
