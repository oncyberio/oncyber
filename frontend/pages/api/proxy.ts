import { corsMiddleware } from "../../utils/middlewares/corsMiddleware";
import { publicFetch } from "@utils/net/publicFetch";

// Minimal Response-like view over publicFetch for the code below.
async function fetchPublic(url: string) {
    const r = await publicFetch(url, { maxBytes: 5 * 1024 * 1024, accept: "text/html,*/*" });
    const headers = new Headers();
    for (const [k, v] of Object.entries(r.headers)) if (typeof v === "string") headers.set(k, v);
    return { ok: r.status >= 200 && r.status < 300, url: r.url, headers, text: async () => r.body.toString("utf8") };
}

async function tryFetch(q: string) {
    //

    let hasProtocol = q.startsWith("http://") || q.startsWith("https://");

    let url = q;

    if (!hasProtocol) {
        //
        url = "http://" + q;

        console.log("URL without protocol, trying http://");
    }

    try {
        //
        const resp = await fetchPublic(url);

        if (!resp.ok) throw new Error("Failed to fetch");

        return resp;
        //
    } catch (err) {
        //
        console.error(err);

        if (!hasProtocol) {
            //
            url = "https://" + q;

            console.log("URL without protocol, trying https://");

            return fetchPublic(url);
            //
        } else {
            //
            throw err;
        }
    }
}

export default async (req, res) => {
    //
    await corsMiddleware(req, res);

    try {
        //
        let response;

        try {
            //
            response = await tryFetch(String(req.query.url ?? ""));

            if (!response.ok) throw new Error("Not found");
            //
        } catch (err) {
            //
            console.error(err);

            //
            return res.json({
                success: false,
                notFound: true,
            });
        }

        const html = await response.text();

        const headers = response.headers;

        let blocked = headers?.get("X-Frame-Options") === "SAMEORIGIN";

        // console.log("BLOCKED", blocked, headers);

        return res.json({
            success: true,
            url: response.url,
            html,
            blocked,
        });
        //
    } catch (e) {
        //
        console.error(e);

        return res.json({
            success: false,
            message: e.message,
        });
    }
};
