import { useEffect, useRef } from "react";

export function useOnClickOutside({ handler }) {
    const clickRef = useRef(null);
    const togglerRefs = useRef({});

    function addTogglerRef(id, el) {
        if (el == null && togglerRefs.current[id]) {
            delete togglerRefs.current[id];
        } else if (el && !togglerRefs.current[id]) {
            togglerRefs.current[id] = el;
        }
    }

    useEffect(() => {
        const listener = (event) => {
            if (
                Object.keys(togglerRefs.current).length &&
                Object.values(togglerRefs.current).find((el: HTMLElement) => {
                    return el?.contains(event.target);
                })
            ) {
                return;
            }

            if (!clickRef.current || clickRef.current.contains(event.target)) {
                return;
            }

            handler(event);
        };

        document.addEventListener("mousedown", listener);

        document.addEventListener("touchstart", listener);

        return () => {
            document.removeEventListener("mousedown", listener);

            document.removeEventListener("touchstart", listener);
        };
    }, [clickRef, handler]);

    return {
        clickRef,
        togglerRefs,
        addTogglerRef,
    };
}
