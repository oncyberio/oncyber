import { useEffect, useRef } from "react";
import { Transition } from "react-transition-group";
import styled from "styled-components";
import Modal from "./Modal";

const duration = 400;

const defaultStyle = {
    transition: `all ${duration}ms ease`,
    opacity: 0,
    zIndex: -1000,
    top: "100%",
    left: 0,
    position: "fixed",
    width: "100%",
    height: "100%",
};

const transitionStyles = {
    entering: { opacity: 1, zIndex: 10000000, top: 0 },
    entered: { opacity: 1, zIndex: 10000000, top: 0 },
    exiting: { opacity: 1, top: "100%" },
    exited: { opacity: 0, top: "100%" },
};

const overlayTransitionStyles = {
    entering: { opacity: 1 },
    entered: { opacity: 1 },
    exiting: { opacity: 0 },
    exited: { opacity: 0 },
};

export default function AnimatedModal({ isShowing, children, ...props }) {
    const rootRef = useRef(null);

    return (
        <Transition
            addEndListener={(node, done) => {
                // use the css transitionend event to mark the finish of a transition
                // node.addEventListener('transitionend', done, false);
                // console.log(node, done);
            }}
            in={isShowing}
            timeout={duration}
        >
            {(state) => {
                return (
                    <div
                        ref={rootRef}
                        style={{
                            ...defaultStyle,
                            ...transitionStyles[state],
                        }}
                    >
                        <Modal
                            overlayStyle={{
                                ...overlayTransitionStyles[state],
                            }}
                            rootRef={rootRef}
                            {...props}
                            isShowing={state !== "exited"}
                            // Closing already: Escape goes to the window below.
                            isExiting={!isShowing}
                            //isDirectShowing={isShowing}
                        >
                            {children}
                        </Modal>
                    </div>
                );
            }}
        </Transition>
    );
}
