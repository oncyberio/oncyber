export function cloneValue<T>(value: T): T {
    if (typeof structuredClone === "function") return structuredClone(value);
    return JSON.parse(JSON.stringify(value)) as T;
}

/** Deep-freezes JSON-shaped model values so UI code cannot mutate store state. */
export function freezeValue<T>(value: T): T {
    if (!value || typeof value !== "object" || Object.isFrozen(value)) {
        return value;
    }
    Object.freeze(value);
    Object.values(value as Record<string, unknown>).forEach((child) =>
        freezeValue(child)
    );
    return value;
}

export function immutableCopy<T>(value: T): T {
    return freezeValue(cloneValue(value));
}
