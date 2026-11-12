import { showInfo } from "@components/Dialogs";
import { useEffect } from "react";
import styled from "styled-components";

export default function Iframe() {
    useEffect(() => {
        window.addEventListener("message", function (event) {
            if (event.data.macys) {
                showInfo("Received message from macy's");
            }
        });
    }, []);

    return null;
}
