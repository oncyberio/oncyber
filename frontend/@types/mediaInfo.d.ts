export type NoTypeMediaInfo = { type: "NoTypeInfo" };

export type UnsupportedMediaInfo = { type: "Unsupported"; mime_type: string };

export type UploadableMediaInfo = {
    type: "Uploadable";
    mime_type: string;
    urlField: string;
    url: string;
    size: number;
};

export type NotUploadableMediaInfo = {
    type: "NotUploable";
    mime_type: string;
    urlField: string;
    url: string;
    size: number;
};

export type SupportedMediaInfo = UploadableMediaInfo | NotUploadableMediaInfo;

export type MediaInfo =
    | NoTypeMediaInfo
    | UnsupportedMediaInfo
    | SupportedMediaInfo;
