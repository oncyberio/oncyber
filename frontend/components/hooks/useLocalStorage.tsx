import { useState } from "react";

function getValue(key, defaultValue) {
    if (typeof window !== "undefined") {
        const state = localStorage.getItem(key);

        return state === null ? defaultValue : JSON.parse(state);
    } else {
        return defaultValue;
    }
}

export default function useLocalStorage({ key, defaultValue }) {
    const [value, setValue] = useState(getValue(key, defaultValue));

    function setLocalstorageValue(value) {
        localStorage.setItem(key, value);

        setValue(value);
    }

    return {
        value,
        setValue: setLocalstorageValue,
    };
}
