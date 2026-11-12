
const LineHeight = 10; // In Points
const Duration = 350; // In milliseconds
const MinWidth = 10;
const FontSize = LineHeight * 0.4;
const LabelFont = `normal ${Math.floor(FontSize)}px Aeonik, Arial, sans-serif`;
const ValueFont = `normal ${Math.floor(FontSize)}px Aeonik, Arial, sans-serif`;
const LabelColor = "#ffffff99";
const ValueColor = "#ffffffff";
const ScalarArt = 15;


function roundedImage(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
}

/**
 *
 * @param { any } img
 * @param { CanvasRenderingContext2D } ctx
 * @param { number } scalar
 * @param { number } offsetLeft
 * @param { number } offsetTop
 * @param { number } width
 * @param { number } height
 * @param { boolean } rounded
 */
function drawIcon(
    img,
    ctx,
    scalar,
    offsetLeft,
    offsetTop,
    width,
    height,
    rounded
) {
    ctx.save();
    ctx.scale(scalar, scalar);

    if (rounded) {
        roundedImage(ctx, offsetLeft, offsetTop, width, height, 10);
        ctx.strokeStyle = "#ffffff00";
        ctx.stroke();
        ctx.clip();
    }

    if (!img) {
        var grd = ctx.createLinearGradient(0, 0, 200, 0);
        grd.addColorStop(0, "#581F84");
        grd.addColorStop(1, "#861C23");
        ctx.fillStyle = grd;
        ctx.fillRect(offsetLeft, offsetTop, width, height);
    } else {

        var mult = 1

        if( typeof(img) == 'object'){
            mult = -1
        }

        ctx.scale(1, 1 * mult)


        try {

            ctx.drawImage(img, offsetLeft, offsetTop * mult, width, height  * mult );
            ctx.scale(1, 1)

        } catch(err) {

            console.log(err);
        }
    }
    ctx.restore();
}

function renderReaction(ctx, count, order, width) {
    const reactLeft = width * 0.25;
    const reactTop = FontSize * 0.5;
    const reactSpacing = width * 0.15;
    const reactWidth = LineHeight / 2.5; //width * .05;
    const reactBGColor = "#00000055";
    const reactLabelTop = reactTop + FontSize * 1.75;

    // BG Circle
    renderBGCircle(
        ctx,
        reactLeft + reactSpacing * order,
        reactTop,
        reactWidth,
        reactBGColor
    );

    // Count
    ctx.fillStyle = LabelColor;
    ctx.textAlign = "center";
    ctx.fillText(
        `${abbreviateCount(count)}`,
        reactLeft + reactSpacing * order + reactWidth / 2,
        reactLabelTop
    );
}

function renderBGCircle(ctx, left, top, diameter, color) {
    ctx.beginPath();
    ctx.arc(left + diameter / 2, top + diameter / 2, diameter, 0, 2 * Math.PI);
    ctx.fillStyle = color;
    ctx.fill();
}

function abbreviateCount(count) {
    if (count < 1000) {
        return parseInt(count);
    } else if (count > 999 && count < 1000000) {
        // Thousands with K
        return (count / 1000).toString().substring(0, 3) + "K";
    } else if (count > 999999 && count < 1000000000) {
        // Millions with M
        return (count / 1000000).toString().substring(0, 3) + "M";
    } else if (count > 999999999) {
        // Billions with B
        return (count / 1000000000).toString().substring(0, 3) + "B";
    }
}

function wrapChar(ctx, text, x, y, maxWidth, lineHeight, textSize) {
    var line = "";
    textSize = textSize || { w: 0, h: 0 };

    for (var n = 0; n < text.length; n++) {
        var testLine = line + text[n];
        var metrics = ctx.measureText(testLine);
        var testWidth = metrics.width;
        if (testWidth > maxWidth && n > 0) {
            ctx.fillText(line, x, y);
            line = text[n];
            y += lineHeight;
            textSize.h += lineHeight;
        } else {
            line = testLine;
        }
    }
    ctx.fillText(line, x, y);

    return textSize;
}

/**
 *
 * @param { CanvasRenderingContext2D } ctx
 * @param { string } text
 * @param { number } x
 * @param { number } y
 * @param { number } maxWidth
 * @param { number } lineHeight
 * @returns
 */
function wrapWord(
    ctx,
    text,
    x,
    y,
    maxWidth,
    lineHeight
) {
    // Split words individually
    var words = text.split(" ");
    var line = "";
    var textSize = { w: 0, h: 0 };
    var lastWidth = 0;

    for (var n = 0; n < words.length; n++) {
        const currentWordWidth = ctx.measureText(words[n]).width;
        var testLine = line + words[n];
        if (n + 1 < words.length) testLine += " ";
        var metrics = ctx.measureText(testLine);
        var testWidth = metrics.width;

        if (testWidth > maxWidth) {
            textSize.w = Math.max(textSize.w, lastWidth);

            if (n > 0 && n + 1 < words.length) {
                ctx.fillText(line, x, y);
                lastWidth = metrics.width;
                line = words[n] + " ";
                y += lineHeight;
                textSize.h += lineHeight;
            } else {
                //need to break the word itself.

                textSize = wrapChar(
                    ctx,
                    testLine,
                    x,
                    y,
                    maxWidth,
                    lineHeight,
                    textSize
                );
                break;
            }
        } else {
            textSize.w = Math.max(textSize.w, metrics.width);
            line = testLine;
        }
    }

    ctx.fillText(line, x, y);
    textSize.h += lineHeight;
    return textSize;
}

export function scaleToFill(img, ctx) {
    // get the scale
    var scale = Math.max(
        ctx.canvas.width / img.width,
        ctx.canvas.height / img.height
    );
    // get the top left position of the image
    var x = ctx.canvas.width / 2 - (img.width / 2) * scale;
    var y = ctx.canvas.height / 2 - (img.height / 2) * scale;
    ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
}

export {
    drawIcon,
    LabelColor,
    LabelFont,
    ValueColor,
    ValueFont,
    FontSize,
    LineHeight,
    Duration,
    MinWidth,
    ScalarArt,
    renderReaction,
    abbreviateCount,
    wrapWord,
};
