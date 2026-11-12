function areItemsEqual(prevItems: any, nextItems: any) {
    //
    return (
        prevItems.length === nextItems.length &&
        prevItems.every((item, index) => item === nextItems[index])
    );
}

export function arePropsEqual(prevProps: any, nextProps: any) {
    //
    return (
        prevProps.nullable === nextProps.nullable &&
        prevProps.value === nextProps.value &&
        areItemsEqual(prevProps.items, nextProps.items) &&
        prevProps.onChange === nextProps.onChange
    );
}

/** Primitive choices compare by value; object choices may use an explicit ID. */
export function isSelectedOption(item: any, value: any): boolean {
    return (
        item === value ||
        (item != null &&
            value != null &&
            typeof item === "object" &&
            typeof value === "object" &&
            item.id != null &&
            value.id != null &&
            item.id === value.id)
    );
}
