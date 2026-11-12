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
        primary: "#070707",
    },
    foreground: {
        primary: "#ffffff",
    },
    text: {
        primary: "#ffffff",

        inverse: "#070707",
    },
};

export default {
    type: "dark",
    background: "#000",
    color: "#fff",
    filters: {
        invert: 0,
    },
    border: {
        color: "rgba(255, 255, 255, 0.2)",
    },
    colors,
};
