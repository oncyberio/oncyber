import { useCallback, useState } from "react";

export function useToggle(seed: boolean): [boolean, (b?: boolean) => void] {
    const [value, setValue] = useState(seed);

    const toggle = useCallback(
        (b?: boolean) => {
            setValue((state) => (b === undefined ? !state : b));
        },
        [setValue]
    );

    return [value, toggle];
}
