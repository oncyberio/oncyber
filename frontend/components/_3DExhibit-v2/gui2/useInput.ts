// @ts-check

import { getLens } from "./lens";
import { idFormat } from "./formats";
import { useRef } from "react";
import { useDispatcher } from "./Dispatcher";
import { useEventCallback } from "@components/hooks/useEventCallback";

export function useInput({
    source,
    onChange: _onChange,
    format = idFormat,
    opts = {},
}) {
    //
    const dispatcher = useDispatcher();

    const lens = getLens(source);

    const dataValue = lens.get();

    const uiValue = format.format(dataValue, opts);

    // WE NEED TO KEEP THE START VALUE FOR UNDO
    // It must be the ui value since data values are mutable
    const startUiValue = useRef(uiValue);

    const onChange = useEventCallback((newUiValue, isProgress) => {
        //

        const newDataValue = format.parse(newUiValue, dataValue, opts);

        let info = null;
        let undo = null;

        if (!isProgress) {
            //

            if (dispatcher.supportsUndo) {
                //
                const oldUIValue = startUiValue.current;

                undo = () => {
                    //
                    const dataValue = lens.get();

                    let oldDataValue = format.parse(
                        oldUIValue,
                        dataValue,
                        opts
                    );

                    lens.set(oldDataValue);

                    _onChange?.(oldDataValue, false);
                };

                info = {
                    prop: lens.path || "",
                    oldValue: startUiValue.current,
                    newValue: newUiValue,
                };
            }

            startUiValue.current = newUiValue;
        }

        const setNewValue = async () => {
            //
            lens.set(newDataValue, { isProgress });

            await _onChange?.(newDataValue, isProgress);
            //
        };

        dispatcher.dispatch({
            run: async () => {
                //
                await setNewValue();

                if (undo) {
                    //
                    return {
                        info,
                        undo,
                        redo: setNewValue,
                    };
                }
            },
            isProggress: isProgress,
        });
    }, []);

    return { value: uiValue, onChange };
}
