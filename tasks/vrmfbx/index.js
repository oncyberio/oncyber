const fs = require("fs");

const path = require("path");

const fetchBuffer = require("./fetch.js");

const fbxParser = require("./lib/fbxparser.js").default;

var fbxLoader = new fbxParser();

const sourceFiles = [];

const sourcePath = "./sources/";

fs.readdirSync(sourcePath).forEach((file) => {
    sourceFiles.push(file);
});

var tempData = [];

const urls = [];

let c = 0;

while (c < sourceFiles.length) {
    if (sourceFiles[c] != ".DS_Store") {
        const name = sourceFiles[c].split(".");

        urls.push(path.resolve(sourcePath + sourceFiles[c]));
    }

    c++;
}

const finalJson = [];

const dest =
    process.env.VRM_ANIMATIONS_DIR ||
    __dirname + "/../../frontend/components/_3DExhibit-v2/three/factory/player/instanceavatarvrm/animations/";

async function process() {
    let i = 0;

    while (i < urls.length) {
        console.log("processing .. ", i);

        const anim = await fetchBuffer(urls[i]);

        console.log(urls[i]);

        // const res = fbxLoader.parse( buffer )

        const splitted = urls[i].split("/");

        const name = splitted[splitted.length - 1].split(".")[0];

        console.log(name);

        // const anim = res.animations[0].toJSON()

        let g = 0;

        while (g < anim.tracks.length) {
            const val = anim.tracks[g].values;

            // console.log( val )

            let h = 0;

            while (h < val.length) {
                val[h] = parseFloat(val[h].toFixed(3));

                h++;
            }

            const times = anim.tracks[g].times;

            h = 0;

            while (h < times.length) {
                times[h] = parseFloat(times[h].toFixed(2));

                h++;
            }

            g++;
        }

        anim.name = name;

        // console.log( name )

        finalJson.push(anim);

        i++;
    }

    let outputDataData = JSON.stringify(finalJson);

    fs.writeFileSync(dest + "compute2.json", outputDataData);
}

process();
