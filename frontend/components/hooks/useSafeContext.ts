import { useContext } from "react";

export function useSafeContext<T>(context: React.Context<T>): T {
    //
    const value = useContext(context);

    if (value == null) {
        throw new Error(
            "context not found " + context.displayName || context.Provider.name
        );
    }

    return value;
}
