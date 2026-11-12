import dynamic from "next/dynamic";
const ArtworkInfoPreview = dynamic(
    () =>
        import(
            "@components/_3DExhibit-v2/ui/ControlPanel/ArtworkInfoBulle/testing/ArtworkInfoPreview"
        ),
    { ssr: false }
);
export default ArtworkInfoPreview;
export function getServerSideProps() {
    return process.env.NODE_ENV === "development"
        ? { props: {} }
        : { notFound: true };
}
