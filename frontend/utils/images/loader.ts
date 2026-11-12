export function cloudinaryLoader({ src, width, quality }) {
    const splitLink = src.split("/");

    const index = splitLink.findIndex((s) => s.indexOf("upload") > -1);

    const paramsIndex = splitLink.findIndex((s) => s.indexOf(",") > -1);

    if (paramsIndex > -1) {
        splitLink[paramsIndex] = `w_${width},q_${quality || 75}`;
    } else {
        splitLink.splice(index + 1, 0, `w_${width},q_${quality || 75}`);
    }

    const dotIndex = splitLink[splitLink.length - 1].lastIndexOf(".");

    splitLink[splitLink.length - 1] =
        splitLink[splitLink.length - 1].slice(0, dotIndex) + ".webp";

    return splitLink.join("/");
}

export function othersLoader({ src, width }) {
    return src;
}
