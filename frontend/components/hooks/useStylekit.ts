import { getStylekitByRoom, getStylekitList } from "@utils/saveToDb";
import useSWR from "swr";

async function fetchStylekit(slug: string) {
    try {
        let stylekit = await getStylekitByRoom(slug);
        return stylekit;
    } catch (error) {
        console.error(error);
        throw new Error(error.message || "Failed to fetch style kit");
    }
}

export function useStylekit(slug: string) {
    return useSWR([slug, "stylekit"], ([slug, _]) => {
        if (slug == null) return null;
        return fetchStylekit(slug);
    });
}

async function fetchStylekitList() {
    return getStylekitList();
}

export function useStylekitList() {
    return useSWR(["stylekitlist"], () => {
        return fetchStylekitList();
    });
}
