import Emitter from "events";
import React from "react";
import { createRoot } from "react-dom/client";
import { GUIWrapper } from "./GuiWrapper";
import { UndoManager } from "./commands/UndoManager";

export class GUI extends Emitter {
    //
    constructor(opts) {
        //
        super();

        this.setSource(opts.source || { type: "group", children: {} });

        this.opts = opts || {};

        this.defUndoManager = new UndoManager();
    }

    setSource(source) {
        //
        if (source === this.source) return;

        this.isConfig = false;

        this.source = source;

        if (typeof source.getGUI === "function") {
            //
            this.object = source;
            //
        } else if (typeof source === "function") {
            //
            this.object = { getGUI: source };
        } else {
            //
            this.isConfig = true;

            this.config = source;

            this.object = { getGUI: () => this.source };
        }
    }

    mount() {
        //

        if (this.root) {
            //
            console.error("GUI is already mounted");
            return;
        }

        this.node = document.createElement("div");

        document.body.appendChild(this.node);

        this.root = createRoot(this.node);

        this.update();
    }

    update(opts) {
        //
        if (this.root) {
            //
            this.root.render(this.render());
        }

        this.emit("update", opts);
    }

    render(props) {
        //
        if (props?.source) {
            //
            this.setSource(props.source);
        }

        this.undoManager = props?.undoManager || this.defUndoManager;

        return React.createElement(GUIWrapper, {
            gui: this,
            props,
            undoManager: this.undoManager,
            autoUndo: props?.autoUndo,
        });
    }

    unmount() {
        //
        if (!this.root) {
            //
            console.error("GUI is not mounted");
            return;
        }

        this.root.unmount();

        this.root = null;

        this.node.remove();

        this.node = null;
    }
}

export function mount(source, opts) {
    //
    const gui = new GUI(source, opts);

    gui.mount();

    return gui;
}
