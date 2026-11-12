import {
    GUI
} from "@gui/GUI";


const gui = new GUI({
    title: "Edit Element",
    style: {
        position: "absolute",
        width: 310,
        top: 120,
        right: 25,
        zIndex: 100,
    },
    undo: true,
});

export default gui;
