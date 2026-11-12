// @ts-check

import { drawIcon, wrapWord } from "@3/three/utils/draw";

function curatorInfo(
    user,
    avatarImg,
    ctx,
    offsetLeft,
    offsetTop,
    color,
    titleWidth,
    iconWidth = ctx.canvas.width / 5,
    title,
    res
) {
    if (avatarImg) {
        drawIcon(
            avatarImg,
            ctx,
            1,
            offsetLeft,
            offsetTop,
            iconWidth,
            iconWidth,
            true
        );
    }

    if (!avatarImg) {
        drawIcon("", ctx, 1, offsetLeft, offsetTop, iconWidth, iconWidth, true);
    }
    const textLeftOffset = 10;
    const fontSize = (iconWidth * res) / 7;
    const lineHeight = fontSize * 2;

    ctx.font = `bold ${fontSize}px SpaceGrotesk, Arial, sans-serif`;
    ctx.fillStyle = color;
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    ctx.fillStyle = "#fff";

    // ctx.shadowOffsetX     = 2
    // ctx.shadowOffsetY     = 2
    // ctx.shadowColor       = "rgba(0,0,0,1)"
    // ctx.shadowBlur        = 4

    ctx.fillText(
        title,
        iconWidth + offsetLeft + textLeftOffset,
        offsetTop + fontSize
    );

    ctx.font = `${(iconWidth * res) / 5}px SpaceGrotesk, Arial, sans-serif`;
    ctx.fillStyle = color;
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    ctx.fillStyle = "#fff";

    let walletId = user?.walletId ? user.walletId.slice(0, 8) + "..." : "";

    const size = wrapWord(
        ctx,
        user?.username || walletId || "",
        iconWidth + offsetLeft + textLeftOffset,
        offsetTop + lineHeight * 1.5,
        titleWidth - offsetLeft * 2,
        lineHeight
    );

    return {
        offsetLeft: iconWidth + offsetLeft + textLeftOffset + size.w,
        offsetTop: offsetTop + iconWidth,
    };
}

/**
 *
 * @param { import("@uitypes/experience").Experience } exhibit
 * @param { import("@uitypes/user").User } user
 * @param { HTMLImageElement } avatarImg
 * @param { CanvasRenderingContext2D } ctx
 * @param { number } res
 */
export function destinationInfo(
    exhibit,
    user,
    avatarImg,
    ctx,
    res
) {
    const { editors, info, number_of_visits, owner } = exhibit;
    const { curator, room, headline, heroImg } = info;

    const fontSize = 18 * res;
    const color = "#ffffff";
    const titleWidth = ctx.canvas.width;
    const lineHeight = fontSize * 2;
    const padding = 8 * res;

    const titleTop = lineHeight; // + ctx.canvas.height / 1.5;

    // Title
    ctx.font = `bold ${fontSize * 1.5}px SpaceGrotesk, Arial, sans-serif`;
    ctx.fillStyle = color;
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    ctx.fillStyle = "#fff";


    // ctx.shadowOffsetX     = 2
    // ctx.shadowOffsetY     = 2
    // ctx.shadowColor       = "rgba(0,0,0,1)"
    // ctx.shadowBlur        = 4

    const metrics = ctx.measureText(info.headline || "");

    const textWidth = metrics.width || ctx.canvas.width - padding * 2; // In case no headline add one line

    const contentHeight =
        ctx.canvas.height -
        (lineHeight * (Math.ceil(textWidth / (titleWidth - padding * 2)) + 2) +
            ctx.canvas.width / 10);

    // console.log(
    //     exhibit.info.headline,
    //     textWidth + padding * 2,
    //     ctx.canvas.width
    // );

    const textSize = wrapWord(
        ctx,
        info.headline || "",
        padding,
        contentHeight + titleTop,
        titleWidth - padding * 2,
        lineHeight
    );

    curatorInfo(
        user,
        avatarImg,
        ctx,
        padding,
        contentHeight + textSize.h + titleTop,
        color,
        titleWidth,
        ctx.canvas.width / 10,
        "OWNER",
        2
    );
}
