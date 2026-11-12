export function formatCinematic(cinematic) {
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

export function parseCinematic(cinematic) {
    var newCinematic = { export: [] };

    cinematic.export.forEach((spline) => {
        const { position, lookat, duration } = spline;

        const newSpline = {
            duration,
            position: [],
            lookat: [],
        };

        position.forEach((point) => {
            newSpline.position.push(point.point);
        });

        lookat.forEach((point) => {
            newSpline.lookat.push(point.point);
        });

        newCinematic.export.push(newSpline);
    });

    return newCinematic;
}
