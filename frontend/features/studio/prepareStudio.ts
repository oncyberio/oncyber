import { prepareNavigation } from "@utils/navigationSaves";
import { startAnonExhibit } from "@utils/anon";
import { getDestination } from "@utils/saveToDb";
import type { Experience } from "@uitypes/experience";

export async function prepareStudio(exhibit: Experience, anonymous: boolean) {
    await Promise.all([
        // Guest hydration reuses this cache after routing; overlap it with saving.
        anonymous ? getDestination(exhibit.info.room) : null,
        (async () => {
            await prepareNavigation();
            if (anonymous) await startAnonExhibit(exhibit);
        })(),
    ]);
}
