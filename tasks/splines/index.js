const fs = require("fs");
const path = require("path");
const db = require("./firebase");

function formatCinematic(cinematic) {
    const newCinematic = { export: [] };

    cinematic.export.forEach((spline) => {
        const { position, lookat, duration } = spline;

        const newSpline = {
            duration,
            position: [],
            lookat: [],
        };

        position.forEach((point) => {
            newSpline.position.push({ point });
        });

        lookat.forEach((point) => {
            newSpline.lookat.push({ point });
        });

        newCinematic.export.push(newSpline);
    });

    return newCinematic;
}

(async () => {
    console.log("STARTED SAVING SPLINES...")

    await Promise.all(
        fs.readdirSync(path.join(__dirname, "./jsons")).map(async fileName => {
            const slug = fileName.split(".")[0];

            const file = fs.readFileSync(path.join(__dirname, `./jsons/${ fileName }`));

            const cinematic = JSON.parse(file);

            await db
                .collection("cinematic")
                .doc(slug)
                .set(formatCinematic(cinematic));
        })
    )

    console.log("SAVING SPLINES DONE :D")
})()
