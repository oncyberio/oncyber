import { Store, useStore } from "@components/_3DExhibit-v2/hooks/Store";

type ScriptState = {
    isOpen: boolean;
};

const scriptEditorStore = new Store<ScriptState>({ isOpen: false });

export function useScriptEditorStore() {
    //
    const store = useStore(scriptEditorStore);

    const toggle = (b?: boolean) => {
        //
        store.update((state) => {
            //
            let newVal = b ?? !state.isOpen;

            if (newVal == state.isOpen) return;

            state.isOpen = newVal;
        });
    };

    return {
        ...store,
        toggle,
    };
}
