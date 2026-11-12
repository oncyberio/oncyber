import { useEffect, useRef, useState } from "react";
import { DispatcherProvider } from "../Dispatcher";
import { RenderObjectGui } from "../RenderGui";
import { Panel } from "../controls/Panel";
import { UndoManager } from "./commands/UndoManager";
import { ActionCommand } from "./commands/ActionCommand";
import { GUI } from ".";

const keydownTargets = ["INPUT", "TEXTAREA", "SELECT"];

const defStyle = {
    position: "fixed",
    top: 10,
    right: 10,
    width: 400,
    zIndex: 100,
} as const;
//
export function GUIWrapper({
    gui,
    props,
    undoManager,
    autoUndo = true,
}: {
    gui: GUI;
    props: any;
    undoManager: any;
    autoUndo?: boolean;
}) {
    //
    const [dummy, setDummy] = useState(0);

    const forceUpdate = () => {
        //
        setDummy((d) => d + 1);
    };

    useEffect(() => {
        //
        function onKeyDown(e: KeyboardEvent) {
            //
            const target = e.target as any;

            if (!autoUndo) return;

            if (
                !target.dataset?.noundo &&
                keydownTargets.includes(target.tagName)
            ) {
                //
                return;
            }

            if (e.ctrlKey && e.key === "z") {
                //
                e.preventDefault();

                undoManager.undo();
                //
            } else if (e.ctrlKey && e.key === "y") {
                //
                e.preventDefault();

                undoManager.redo();
            }
        }

        gui.on("update", forceUpdate);

        undoManager.on("command", forceUpdate);

        window.addEventListener("keydown", onKeyDown);

        return () => {
            //
            window.removeEventListener("keydown", onKeyDown);

            gui.off("update", forceUpdate);

            undoManager.off("command", forceUpdate);
        };
    }, []);

    const dispatch = async (payload) => {
        //
        const result = await payload.run();

        if (undoManager != null && result?.undo && result?.redo) {
            //
            const cmd = new ActionCommand(result);

            undoManager.pushCommand(cmd);
            //
        }

        forceUpdate();
    };

    let style = defStyle;

    if (gui.opts.style) {
        //
        style = {
            position: "absolute",
            zIndex: 100,
            ...gui.opts.style,
        };
    }

    let content = gui.object ? (
        <DispatcherProvider
            dispatch={dispatch}
            supportsUndo={undoManager != null}
        >
            <RenderObjectGui object={gui.object} />
        </DispatcherProvider>
    ) : null;

    if (props?.embedded) {
        //
        return content;
    }

    return (
        <Panel title={gui.opts.title || gui.opts.name} style={style} {...props}>
            {content}
        </Panel>
    );
}
