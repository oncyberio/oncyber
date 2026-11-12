import find from "lodash/find";

export async function checkUserWhitelisted(url: string, userId: string) {
    const response = await fetch(url);
    const data = await response.json();
    const isUserWhisteListed = find<Record<string, any>>(
        data || [],
        (o) => o?.address?.toLowerCase?.() === userId?.toLowerCase?.()
    );
    return isUserWhisteListed;
}
