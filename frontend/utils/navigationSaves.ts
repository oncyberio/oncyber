type Save = () => Promise<unknown>;
const guards = new Set<Save>();
const pending = new Set<Promise<unknown>>();
export function registerNavigationSave(save: Save) {
    guards.add(save);
    return () => {
        guards.delete(save);
    };
}
export function trackNavigationSave(save: Promise<unknown>) {
    pending.add(save);
    void save.finally(() => pending.delete(save)).catch(() => {});
    return save;
}
export async function waitForNavigationSaves() {
    await Promise.all([...pending]);
}
export async function prepareNavigation() {
    await Promise.all([...guards].map((save) => trackNavigationSave(save())));
    await waitForNavigationSaves();
}
