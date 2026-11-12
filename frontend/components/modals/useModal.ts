import { useState } from "react";

const useModal = (_isShowing = false) => {
    const [isShowing, setIsShowing] = useState(_isShowing);

    function toggle(b?: boolean) {
        setIsShowing(b ?? !isShowing);
    }

    return {
        isShowing,
        toggle,
    };
};

export default useModal;
