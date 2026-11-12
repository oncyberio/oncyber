import React from "react";

export interface DispatchPayload {
    run: () => void;
    undo?: () => void;
    redo?: () => void;
    isProggress?: boolean;
    info?: any;
}

interface DispatcherContextType {
    dispatch: (payload: DispatchPayload) => unknown | Promise<unknown>;
    supportsUndo: boolean;
}

const DispatcherContext = React.createContext<DispatcherContextType>(null);

export function DispatcherProvider({ children, dispatch, supportsUndo }) {
    //
    // const [dummy, setDummy] = React.useState(0);

    // const dispatch = (payload) => {
    //
    // const before = window.$state.model.data.meshes[0].material.opacity;
    // dispatcher(payload);
    //const after = window.$state.model.data.meshes[0].material.opacity;
    // console.log("opacity changed from", before, "to", after, {
    //     isProggress,
    // });

    // if (!isProggress) {
    //
    // setDummy((prev) => prev + 1);
    // }
    // };

    const value = React.useMemo(() => {
        //
        return {
            dispatch,
            supportsUndo,
        };
    }, [supportsUndo]);

    return (
        <DispatcherContext.Provider value={value}>
            {children}
        </DispatcherContext.Provider>
    );
}

export function useDispatcher() {
    //
    return React.useContext(DispatcherContext);
}
