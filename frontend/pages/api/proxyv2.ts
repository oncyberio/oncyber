// Media proxy for artwork/preview assets on hosts without CORS.
import { corsMiddleware } from "../../utils/middlewares/corsMiddleware";
import { publicFetch } from "@utils/net/publicFetch";

const MEDIA = /^(image|video|audio|model)\/[\w.+-]+$|^application\/(octet-stream|json|gltf-buffer|wasm)$/i;

export default async function handler(req, res) {
  try {
    await corsMiddleware(req, res);

    const response = await publicFetch(String(req.query.url ?? ""), {
      maxBytes: 100 * 1024 * 1024,
      timeoutMs: 30000,
    });
    if (response.status < 200 || response.status >= 300) throw new Error("Upstream error");

    // Only media types pass through; anything else (HTML, SVG with script,
    // text) is served as an opaque download so it never runs on our origin.
    const type = String(response.headers["content-type"] ?? "").split(";")[0].trim();
    const safe = MEDIA.test(type) && !/svg|html|xml/i.test(type);
    res.setHeader('Content-Type', safe ? type : 'application/octet-stream');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
    // Proxied assets here are immutable (NFT/art preview images keyed by a
    // token URL), so let Vercel's CDN + the browser cache them instead of
    // re-fetching upstream on every texture load. GET + no Set-Cookie → the
    // response meets Vercel's cacheable criteria.
    res.setHeader(
      'Cache-Control',
      'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800'
    );
    return res.send(response.body);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch asset' });
  }
}
