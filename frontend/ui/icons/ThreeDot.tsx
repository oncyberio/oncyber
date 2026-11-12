type IconProps = {
    width?: string;
    height?: string;
    stroke?: string;
    strokeWidth?: string;
};

const ThreeDotIcon = ({
    width = "24",
    height = "24",
    stroke = "#fff",
    strokeWidth = "1.5",
}: IconProps) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width={width}
        height={height}
        fill="none"
        viewBox="0 0 24 24"
    >
        <path
            stroke={stroke}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={strokeWidth}
            d="M12 13a1 1 0 100-2 1 1 0 000 2zM19 13a1 1 0 100-2 1 1 0 000 2zM5 13a1 1 0 100-2 1 1 0 000 2z"
        ></path>
    </svg>
);

const animatedStyle = `
    .spinner_S1WN {
        animation: spinner_MGfb 0.8s linear infinite;
        animation-delay: -0.8s;
    }

    .spinner_Km9P {
        animation-delay: -0.65s;
    }
    .spinner_JApP {
        animation-delay: -0.5s;
    }
    @keyframes spinner_MGfb {
        93.75%,
        100% {
            opacity: 0.2;
        }
    }
`;

export function ThreeDotSpinner({
    width = "24",
    height = "24",
    fill = "#000",
    loading = false,
}) {
    //

    return (
        <svg
            width={width}
            height={height}
            fill={fill}
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
        >
            <style>{loading ? animatedStyle : ""}</style>
            <circle className="spinner_S1WN" cx="6" cy="12" r="2" />
            <circle
                className="spinner_S1WN spinner_Km9P"
                cx="12"
                cy="12"
                r="2"
            />
            <circle
                className="spinner_S1WN spinner_JApP"
                cx="18"
                cy="12"
                r="2"
            />
        </svg>
    );
}

export default ThreeDotIcon;
