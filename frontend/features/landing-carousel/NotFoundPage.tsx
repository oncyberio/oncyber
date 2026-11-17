import Head from "next/head";
import LandingCarouselPage from ".";
import type { LandingPageProps } from "./types";

/** The landing, shown in place of a space or profile that doesn't exist. */
export default function NotFoundPage(props: LandingPageProps) {
    const query = props.notFound?.query;
    return (
        <>
            <Head>
                <title key="title">
                    {query
                        ? `Could not find “${query}” · oncyber`
                        : "Could not find this world · oncyber"}
                </title>
                <meta key="robots" name="robots" content="noindex" />
            </Head>
            <LandingCarouselPage {...props} />
        </>
    );
}
