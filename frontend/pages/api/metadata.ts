import { publicFetch } from "@utils/net/publicFetch";

export default async (req, res) => {
    //
    try {
        //
        const response = await publicFetch(String(req.query.url ?? ""), {
            maxBytes: 1024 * 1024,
            accept: "application/json",
        });

        if (response.status < 200 || response.status >= 300) throw new Error("Not found");

        const data = JSON.parse(response.body.toString("utf8"));

        //
        return res.json({
            success: true,
            data,
        });
    } catch (err) {
        //
        return res.json({
            success: false,
            notFound: true,
        });
    }
};
