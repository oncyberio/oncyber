// @ts-check

import {
    GUI
} from "@components/_3DExhibit-v2/ui/TweakPane";



const options = {
    width: 310,
    position: {
        top: 90,
        right: 100,
    },
    name: "Cinematic Options",
}

export const cinematicGUI = new GUI(options);

const gui = new GUI(options);

export { GUI };

export default gui;
