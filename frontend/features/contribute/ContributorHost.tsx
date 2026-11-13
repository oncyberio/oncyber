import dynamic from "next/dynamic";
import { useContributeSettings } from "./store";

const ContributorSidebar = dynamic(() => import("./ContributorSidebar"), {
    ssr: false,
});

/** Mounts the contributor sidebar when this browser turned it on. */
export default function ContributorHost() {
    const settings = useContributeSettings();
    if (!settings.enabled || !settings.githubToken || !settings.aiKey)
        return null;
    return <ContributorSidebar settings={settings} />;
}
