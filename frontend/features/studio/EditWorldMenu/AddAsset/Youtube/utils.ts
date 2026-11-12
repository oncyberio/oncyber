import { nodeEnv } from "@env";
import { FetchedAsset } from "@uitypes/Asset";
import { toNum } from "@utils/js";

export interface ApiResponseThumb {
    url: string;
    width: number;
    height: number;
}

export interface ApiResponseItem {
    id:
        | string
        | {
              kind: string;
              videoId: string;
          };
    time?: number;
    snippet: {
        publishedAt: string;
        channelId: string;
        title: string;
        description: string;
        thumbnails: {
            default: ApiResponseThumb;
            medium: ApiResponseThumb;
            high: ApiResponseThumb;
        };
        channelTitle: string;
        liveBroadcastContent: "upcoming" | "live" | "none";
        publishTime: string;
    };
}

interface ApiResponse {
    pageInfo: {
        totalResults: number;
        resultsPerPage: number;
    };
    items: Array<ApiResponseItem>;
}

export async function searchYoutubeBykeyword(q: string): Promise<ApiResponse> {
    q = q?.trim();

    const params = new URLSearchParams({
        part: "snippet",
        maxResults: "50",
        // key: API_KEY,
    });

    let baseUrl = "https://www.googleapis.com/youtube/v3/";

    let time = 0;

    if (q.startsWith("https://www.youtube.com/watch?v")) {
        const qUrl = new URL(q);
        const id = qUrl.searchParams.get("v");

        time = toNum(qUrl.searchParams.get("t")?.split("s")?.[0], 0);

        params.set("key", nodeEnv.YOUTUBE_API_KEY_GET);
        params.set("id", id || "");

        baseUrl += "videos";
    } else {
        params.set("key", nodeEnv.YOUTUBE_API_KEY_SEARCH);
        params.set("type", "video");
        params.set("q", q);
        params.set("videoEmbeddable", "true");

        baseUrl += "search";
    }

    const result: ApiResponse = await fetch(`${baseUrl}?${params}`, {
        headers: {
            Accept: "application/json",
        },
    }).then((response) => response.json());

    result.items.forEach((it) => {
        // Youtube requests can return titles with escaped HTML entities (like &quot;)
        // DOMParser decodes them without running anything in the markup
        it.snippet.title = new DOMParser().parseFromString(
            it.snippet.title,
            "text/html"
        ).documentElement.textContent;

        it.time = time;
    });

    return result;
}

export function formatYoutubeAsset(item: ApiResponseItem): FetchedAsset {
    const thumbs = item.snippet.thumbnails;

    const videoId = typeof item.id === "string" ? item.id : item.id.videoId;

    return {
        name: item.snippet.title,
        description: item.snippet.description,
        token_id: `${videoId}`,
        collection: {
            name: item.snippet.channelTitle,
        },
        mime_type: "embed/youtube",
        image_preview_url: thumbs.medium.url,
        image_url: thumbs.high.url,
        animation_url: videoId,
        blockchain: null,
        customData: item.snippet,
        params: { time: item.time },
    };
}
