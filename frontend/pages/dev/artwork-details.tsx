import dynamic from "next/dynamic";
const ArtworkDetailsPreview = dynamic(
    () =>
        import(
            "@components/modals/ArtworkInfo/C/testing/ArtworkDetailsPreview"
        ),
    { ssr: false }
);
export default ArtworkDetailsPreview;
export function getServerSideProps() {
    return process.env.NODE_ENV === "development"
        ? { props: {} }
        : { notFound: true };
}
