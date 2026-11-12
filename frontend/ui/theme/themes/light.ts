const colors = {
    primary: {
        900: "#fff",
    },
    secondary: {
        900: "#000",
    },
    black: {
        900: "#000",
        700: "#585858",
        400: "#8D8A8A",
        200: "#bbb",
    },
    red: {
        200: "#F88383",
    },
    white: "#fff",
    stateColors: {
        danger: "#FF4B4B",
        success: "#2ABF24",
        warning: "#F89D33",
    },
    background: {
        primary: "#ffffff",
    },
    foreground: {
        primary: "#070707",
    },
    text: {
        primary: "#070707",

        inverse: "#ffffff",
    },
};

export default {
    type: "light",
    background: "#fff",
    color: "#000",
    filters: {
        invert: 1,
    },
    border: {
        color: "rgba(0, 0, 0, 0.6)",
    },
    colors,
};
