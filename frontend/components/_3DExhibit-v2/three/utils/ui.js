// @ts-check

import Emitter from "@3emitter"

import Events from "@3events"

import { IS_VR } from "../constants"

import Renderer from "@3renderer"

import { showInfo } from "@components/Dialogs"

/**
 *
 * @param {{ type: "text" | "password", message: string, onSubmit: (value: string) => void | Promise<void> }} param0
 */
export async function showUIPrompt({ type, message, onSubmit  }) {
    //

    if (IS_VR) {

        return showXRPrompt({ type, message, onSubmit })
    }

    return new Promise((resolve, reject) => {
        //
        Emitter.emit(

            Events.CUSTOM,

            {
                type: Events.UI_PROMPT,

                value: { type, message, onSubmit, resolve, reject }
            }
        )
    })
}


export async function showXRPrompt({ type, message, onSubmit }) {

    const session = Renderer.xr.getSession()

    if (!session.isSystemKeyboardSupported) {

        showInfo("System keyboard not supported")

        return null
    }




    return new Promise((_resolve, reject) => {

        let txtField = document.createElement("input");
        txtField.type = "text";
        txtField.placeholder = message;
        txtField.style.position = "absolute";
        txtField.style.top = window.innerHeight / 2 + "px";
        txtField.style.left = window.innerWidth / 2 + "px";
        txtField.style.width = "300px";
        txtField.style.height = "50px";
        txtField.style.fontSize = "30px";
        txtField.style.border = "none";
        txtField.style.outline = "none";
        txtField.style.background = "black";
        txtField.style.color = "white";
        txtField.style.textAlign = "center";
        txtField.style.borderRadius = "10px";
        txtField.style.padding = "10px";
        txtField.style.boxShadow = "0px 0px 10px 0px rgba(0,0,0,0.75)";
        txtField.style.zIndex = "99999"
        //txtField.style.visibility = "hidden";
        document.body.appendChild(txtField);

        txtField.onblur = resolve

        txtField.focus();


        async function resolve() {

            let value = txtField.value ? txtField.value : null

            if (value) {

                try {

                    await onSubmit(value)
                }
                catch (err) {

                    console.error(err)

                    value = null
                }
            }

            _resolve(value)

            txtField.removeEventListener("blur", reject)

            document.body.removeChild(txtField);
        }

    })
}
