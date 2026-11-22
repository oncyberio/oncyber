import type { NextApiRequest, NextApiResponse } from "next";
import { bases, decodeLook, type Base } from "@features/avatar-builder/look";
import {
    dressDocument,
    type KitDocument,
} from "@features/avatar-builder/modelFile";
import atelier from "@features/avatar-builder/templates/atelier.json";
import relay from "@features/avatar-builder/templates/relay.json";
const templates = { atelier, relay } as unknown as Record<Base, KitDocument>;
export default function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== "GET" && req.method !== "HEAD")
        return res.setHeader("Allow", "GET, HEAD").status(405).end();
    const code = req.query.build;
    const editable = bases.find((base) => code === "edit-" + base);
    const look = decodeLook(code);
    if (!editable && !look) return res.status(404).end();
    const doc = editable
        ? templates[editable]
        : dressDocument(templates[look.base], look);
    res.setHeader("Cache-Control", "public, max-age=0, s-maxage=3600");
    res.setHeader("Content-Type", "model/gltf+json");
    return req.method === "HEAD"
        ? res.status(200).end()
        : res.status(200).send(JSON.stringify(doc));
}
