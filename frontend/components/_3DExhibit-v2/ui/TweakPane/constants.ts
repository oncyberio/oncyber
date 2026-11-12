import Range from "./components/Range";
import List from "./components/List";
import Vector from "./components/Vector";
import Switch from "./components/Switch";
import Button from "./components/Button";
import ColorPicker from "./components/ColorPicker";
import FileInput from "./components/File";

export const LIST_CONTROLLERS = {
    Vector: "Vector",
    LIST: "List",
    SWITCH: "Switch",
    TOGGLE: "Toggle",
    BUTTON: "Button",
    RANGE: "InputRange",
    FILEINPUT: "FileInput",
    COLOR_PICKER: "ColorPicker",
};

export const Controls = {
    [LIST_CONTROLLERS.RANGE]: Range,
    [LIST_CONTROLLERS.LIST]: List,
    [LIST_CONTROLLERS.Vector]: Vector,
    [LIST_CONTROLLERS.SWITCH]: Switch,
    [LIST_CONTROLLERS.BUTTON]: Button,
    [LIST_CONTROLLERS.COLOR_PICKER]: ColorPicker,
    [LIST_CONTROLLERS.FILEINPUT]: FileInput,
};
