const IframeContent = (props) => {
    return (
        <iframe
            sandbox={
                "allow-scripts allow-forms allow-pointer-lock allow-same-origin"
            }
            style={{
                width: "100%",
                borderRadius: "6px",
                overflow: "hidden",
                cursor: "pointer",
                border: "2px solid #777980",
                pointerEvents: "none",
            }}
            scrolling="no"
            frameBorder="0"
            src={props.url}
            height="100%"
            width="100%"
        ></iframe>
    );
};

export default IframeContent;
