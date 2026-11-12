import dynamic from "next/dynamic";
import Head from "next/head";
import type { GetServerSideProps } from "next";

const VideoStudioLab = dynamic(
    () => import("@features/videoStudio/VideoStudioLab"),
    {
        ssr: false,
        loading: () => (
            <div
                style={{
                    width: "100vw",
                    height: "100dvh",
                    display: "grid",
                    placeItems: "center",
                    background: "#101010",
                    color: "#93938e",
                    font: "12px system-ui",
                }}
            >
                Opening Video Studio…
            </div>
        ),
    }
);

// This isolated route exercises the Video workspace without publishing an
// unfinished product entry or touching gallery persistence.
export const getServerSideProps: GetServerSideProps = async () =>
    process.env.NODE_ENV === "development" ? { props: {} } : { notFound: true };

export default function VideoLabPage() {
    return (
        <>
            <Head>
                <title>Video Studio Lab · oncyber</title>
                <meta
                    name="description"
                    content="Agent-directed, manually editable 3D video authoring lab."
                />
            </Head>
            <VideoStudioLab />
        </>
    );
}
