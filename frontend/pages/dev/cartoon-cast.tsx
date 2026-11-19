import AvatarStudy from "./procedural-avatars";

export default function CartoonCastStudy() {
    return <AvatarStudy cartoonOnly />;
}

export function getServerSideProps() {
    return process.env.NODE_ENV === "development"
        ? { props: {} }
        : { notFound: true };
}
