"""Register the skull, eye sockets and fringe in front and profile drawings."""

import numpy as np


def _fit_orbit(front, profile):
    """Corresponding edges of the visible iris and sclera set orbital depth."""

    def spans(image, y, columns, coordinates):
        r, g, b = image[y, columns].astype(np.int16).T
        blue = (b - r > 14) & (b - g > 2)
        sclera = (b > 155) & (r - b < 20) & ~blue
        return coordinates[blue], coordinates[blue | sclera]

    xs = np.arange(12, 36)
    zs = np.arange(32, 55)
    stations = []
    for y in range(129, 137):
        frontal, white = spans(front, y, 490 + xs, xs)
        # The drawn profile places the lower lid a unit below the front view.
        side, opening = spans(profile, y + 1, 200 - zs, zs)
        if not len(frontal) or not len(side):
            continue
        stations.append(
            [
                y,
                float(frontal.min()) - 0.4,
                float(frontal.max()) + 0.4,
                float(side.max()) + 0.4,
                float(side.min()) - 0.4,
                max(float(white.max()) + 0.7, float(frontal.max()) + 1.6),
                float(opening.min()) - 0.4,
            ]
        )
    if len(stations) < 3:
        # Preserve the family socket for palettes that do not expose a blue iris.
        return [
            [129, 18, 30, 48, 44, 33, 39],
            [132, 18, 30, 48, 45, 33, 40],
            [136, 21, 27, 47, 45, 30, 43],
        ]
    return stations


def fit_street_face(front, profile):
    # Register the front jaw against its dark contour. The left cheek is clear
    # of the mouth accessory. Side depth is read from paper/skin transitions.
    scaffold = [
        [51, 1, 10, 8],
        [56, 17, 32, -14],
        [67, 33, 46, -29],
        [86, 43, 55, -42],
        [104, 46, 59, -46],
        [116, 46, 60, -46],
        [125, 45, 60, -45],
        [131, 44, 60, -44],
        [137, 42, 61, -42],
        [144, 39, 66, -38],
        [149, 37, 71, -34],
        [153, 35, 69, -30],
        [157, 33.5, 66, -25],
        [161, 31, 64, -17],
        [165, 28, 64, -10],
        [168, 25.5, 61, -3],
        [171, 22, 60, 5],
        [174, 18, 57, 13],
        [177, 14, 56, 23],
        [180, 10, 55, 32],
        [182, 6, 55, 38],
        [184, 1.5, 52, 46],
    ]
    rows = []
    for y, w, z, back in scaffold:
        if 153 <= y <= 182:
            widths = np.arange(round(w) - 3, round(w) + 4)
            ink = front[y, 490 - widths].mean(1)
            if ink.min() < 130:
                w = float(widths[np.argmin(ink)]) + 0.6
        if y >= 129:
            depths = np.arange(round(z) - 2, round(z) + 3)
            # On the side view the forward contour always has paper outside,
            # except below the mouth where the stick is excluded by this window.
            local = profile[y, 200 - depths].astype(float)
            z = float(depths[np.argmin(local.mean(1))])
        rows.append([y, w, z, back])
    return {
        "orbit": _fit_orbit(front, profile),
        "sections": rows,
        "finish": "brush",
    }


def fit_crown(profile, fringe):
    """Measure the height at which each lock leaves the crown."""
    fringe = np.asarray(fringe)
    ends = np.arccos(np.clip((107 - fringe[:, 1]) / 57, -0.994, 0.994))
    knots = np.arcsin(np.clip(fringe[:, 0] / (53.04 * np.sin(ends)), -0.999, 0.999))
    # Register the lateral tips and clefts in the side drawing. Their profile
    # depth gives their meridian on the same crown as the front fringe.
    lateral = []
    for depth, station in [
        (23.5, 127),
        (31.5, 113),
        (34, 122),
        (39.5, 103),
        (41, 122),
        (47, 104),
        (49, 118),
        (53, 101),
        (56, 120),
        (60, 106),
        (62.3, 127),
    ]:
        line = profile[station - 2 : station + 3, 200 - round(depth)].mean(1)
        h = station - 2 + int(line.argmin())
        phi = np.arccos((107 - h) / 57)
        meridian = np.arccos(np.clip((depth - 10) / (68 * np.sin(phi)), -1, 1))
        lateral.append((meridian, h))
    lateral.sort()
    side_angles, side_heights = map(np.array, zip(*lateral))
    # Keep the dense stations around the two visible fringes. A broad rear
    # meridian can cover the smooth, concealed back of the cap.
    angles = np.unique(
        np.round(
            np.concatenate(
                (np.linspace(-np.pi, np.pi, 15)[:-1], knots, side_angles, -side_angles)
            ),
            4,
        )
    )
    result = []
    for a in angles:
        h = float(np.interp(a, knots, fringe[:, 1]))
        side = np.interp(
            abs(a),
            [*side_angles, 1.57, 1.79, 2.12, 2.56, np.pi],
            [*side_heights, 122, 119, 126, 145, 162],
        )
        t = np.clip((abs(a) - 0.66) / 0.20, 0, 1)
        h = round(h * (1 - t) + side * t, 2)
        result.append([float(a), h])
    return result


def fit_temple_locks(front, profile):
    """Register the four visible edges of a long lock in the two drawings."""

    def edge(image, y, center, sign, expected):
        stations = np.arange(expected - 2, expected + 3)
        light = image[y, center + sign * stations].mean(axis=1)
        return int(stations[np.argmin(light)]) if light.min() < 166 else expected

    # Roots are inside the crown. Past the collar the two edges meet at the tip.
    locks = [[78, 31, 43, 28, 2], [94, 34, 49, 28, 3]]
    for y, medial, lateral, fore, back in [
        (118, 37, 49, 24, 4),
        (135, 37, 48, 23, 5),
        (146, 36, 47, 23, 5),
        (156, 35, 45, 23, 5),
        (170, 35, 44, 23, 8),
        (181, 35, 42, 23, 10),
        (192, 34, 41, 24, 13),
        (205, 34, 39, 25, 16),
        (212, 34, 38, 26, 18),
    ]:
        inner = edge(front, y, 490, 1, medial)
        outer = edge(front, y, 490, 1, lateral)
        forward = edge(profile, y, 200, -1, fore)
        rear = edge(profile, y, 200, -1, back)
        if inner >= outer:
            inner, outer = medial, lateral
        if forward <= rear:
            forward, rear = fore, back
        locks.append([y, inner, outer, forward, rear])
    return [*locks, [230, 35, 35.4, 24, 23.6]]
