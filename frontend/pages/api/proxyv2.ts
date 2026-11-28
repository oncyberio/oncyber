// Media proxy for artwork/preview assets on hosts without CORS.
import { corsMiddleware } from "../../utils/middlewares/corsMiddleware";
import { publicFetch } from "@utils/net/publicFetch";
import { z } from "zod";

const MEDIA = /^(image|video|audio|model)\/[\w.+-]+$|^application\/(octet-stream|json|gltf-buffer|wasm)$/i;

// Assets whose host failed recently, with when we may try again. The CDN
// does not cache a 502, so this instance remembers instead: a space full of
// artworks from a dead host then costs one upstream attempt, not one each.
const FAILED_FOR_MS = 10 * 60 * 1000;
const MAX_REMEMBERED = 5000;
export const recentFailures = new Map<string, number>();

function failedRecently(url: string, now = Date.now()) {
  const until = recentFailures.get(url);
  if (until == null) return false;
  if (until > now) return true;
  recentFailures.delete(url);
  return false;
}

function rememberFailure(url: string, now = Date.now()) {
  if (recentFailures.size >= MAX_REMEMBERED) {
    // Oldest first: a Map keeps insertion order.
    recentFailures.delete(recentFailures.keys().next().value);
  }
  recentFailures.set(url, now + FAILED_FOR_MS);
}

// One asset address per request: a missing or repeated url is a bad request,
// not an upstream failure to remember.
const Query = z.object({ url: z.string().min(1) });

export default async function handler(req, res) {
  const query = Query.safeParse(req.query);
  if (!query.success) {
    return res.status(400).json({ error: 'Expected one url' });
  }
  const url = query.data.url;
  try {
    await corsMiddleware(req, res);

    if (failedRecently(url)) return upstreamFailed(res);

    let response;
    try {
      response = await publicFetch(url, {
        maxBytes: 100 * 1024 * 1024,
        timeoutMs: 30000,
      });
    } catch {
      response = null;
    }
    if (!response || response.status < 200 || response.status >= 300) {
      rememberFailure(url);
      return upstreamFailed(res);
    }

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

// The asset's host is down, gone or refused: that's the upstream's failure,
// not ours. Browsers keep the answer a few minutes too.
function upstreamFailed(res) {
  res.setHeader('Cache-Control', 'public, max-age=300');
  return res.status(502).json({ error: 'Failed to fetch asset' });
}
