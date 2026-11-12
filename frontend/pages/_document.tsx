import Document, {
    Html,
    Head,
    Main,
    NextScript,
    DocumentContext,
} from "next/document";
import { ServerStyleSheet } from "styled-components";
import {
    ENGINE_CHUNKS_ELEMENT_ID,
    readEngineChunks,
    serializeEngineChunks,
} from "@features/lobby/engineChunks";

export default class MyDocument extends Document {
    static async getInitialProps(ctx: DocumentContext) {
        const sheet = new ServerStyleSheet();
        const originalRenderPage = ctx.renderPage;

        try {
            ctx.renderPage = () =>
                originalRenderPage({
                    enhanceApp: (App) => (pageProps) =>
                        sheet.collectStyles(<App {...pageProps} />),
                });

            const initialProps = await Document.getInitialProps(ctx);
            return {
                ...initialProps,
                styles: (
                    <>
                        {initialProps.styles}
                        {sheet.getStyleElement()}
                    </>
                ),
            };
        } finally {
            sheet.seal();
        }
    }

    // not sure about onesignal here or just in studio and spaces
    render() {
        // Lobby pages list the world engine's files for an idle-time prefetch
        // (features/lobby/enginePrefetch.ts). Production only.
        const engineChunks = readEngineChunks(
            this.props.__NEXT_DATA__.page,
            this.props.buildManifest,
            this.props.__NEXT_DATA__.assetPrefix
        );
        return (
            <Html lang="en">
                <Head />

                <body>
                    <Main />
                    {engineChunks && (
                        <script
                            id={ENGINE_CHUNKS_ELEMENT_ID}
                            type="application/json"
                            dangerouslySetInnerHTML={{
                                __html: serializeEngineChunks(engineChunks),
                            }}
                        />
                    )}
                    <NextScript />
                </body>
            </Html>
        );
    }
}

//* to use in local
//* allowLocalhostAsSecureOrigin: true,
