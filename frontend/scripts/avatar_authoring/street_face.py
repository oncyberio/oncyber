"""Fit the forehead, eyes, cheeks and jaw in the registered streetwear cameras.

The triangulation lives on the curved anterior half of the skull. Its sparse
vertices carry pigment in sRGB. No image or per-pixel map ships to the client.
"""

from itertools import pairwise

import numpy as np
from scipy.ndimage import gaussian_filter, map_coordinates


def _simplify_line(line, keep, threshold, a, b):
    if b <= a + 1:
        return
    t = np.arange(1, b - a) / (b - a)
    delta = np.max(
        np.abs(line[a + 1 : b] - (line[a] + t[:, None] * (line[b] - line[a]))), axis=1
    )
    worst = int(delta.argmax())
    if delta[worst] > threshold:
        cut = a + worst + 1
        keep.add(cut)
        _simplify_line(line, keep, threshold, a, cut)
        _simplify_line(line, keep, threshold, cut, b)


def _paint_rows(image, geometry_rows):
    """Simplify each pigment scanline, then sew only neighbouring stations.

    Long unconstrained triangles can bridge a nostril to a lip, or pull the
    black lid pigment across an entire cheek. These edges follow the drawing.
    """
    width = image.shape[1]
    stations = sorted(
        set(map(int, geometry_rows))
        | {
            y - 51
            for y in [
                112,
                114,
                116,
                118,
                120,
                123,
                124,
                125,
                126,
                127,
                128,
                129,
                131,
                133,
                135,
                136,
                137,
                138,
                139,
                142,
                150,
                152,
                154,
                155,
                156,
                163,
                165,
                166,
                167,
                168,
                169,
                170,
                172,
            ]
        }
    )
    points = []
    indices = []
    previous = []
    for row in stations:
        line = image[row].astype(float)
        anchors = [0, 24, 48, 72, width - 1]
        keep = set(anchors)

        threshold = 20 if 124 <= row + 51 <= 139 or row + 51 >= 145 else 26
        for a, b in pairwise(anchors):
            _simplify_line(line, keep, threshold, a, b)
        current = []
        for x in sorted(keep):
            r, g, b = map(int, line[x])
            current.append(len(points))
            points.append([x, row, (r << 16) | (g << 8) | b])
        if previous:
            # Both polylines are x-monotone. Short diagonals keep an eyelid
            # anchored to the next scanline even when its corner moves inwards.
            i = j = 0
            while i < len(previous) - 1 or j < len(current) - 1:
                a, b = previous[i], current[j]
                advance = i < len(previous) - 1 and (
                    j == len(current) - 1
                    or abs(points[previous[i + 1]][0] - points[b][0])
                    <= abs(points[a][0] - points[current[j + 1]][0])
                )
                if advance:
                    indices.extend([a, previous[i + 1], b])
                    i += 1
                else:
                    indices.extend([a, current[j + 1], b])
                    j += 1
        previous = current
    return points, indices


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


def fit_street_face(front, profile, fringe):
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
    rows = np.array(rows)
    y, u = np.indices((134, 97))
    y += 51
    w = np.interp(y, rows[:, 0], rows[:, 1])
    x = (u - 48) * w / 48
    rgb = np.stack(
        [
            map_coordinates(front[..., c].astype(float), [y, 490 + x], order=1)
            for c in range(3)
        ],
        axis=-1,
    )
    # Separate overlying hair from skin. Continue the surrounding skin tone
    # underneath each lock; the actual locks will occlude it when dressed.
    skin = np.array([251, 216, 179])
    lock_inner = np.interp(y, [118, 130, 150, 162, 184], [34, 36, 35, 35, 34])
    upper_lid = (y >= 125) & (y <= 131)
    outside = np.abs(x) > np.where(upper_lid, 38, lock_inner - 1.2)
    hem = np.interp(x, np.array(fringe)[:, 0], np.array(fringe)[:, 1])
    # Paint exposed forehead and brows from the sheet. Continue skin in the
    # region hidden by each discrete lock, keeping strand ink on the hair.
    brow = 116.0 + 0.014 * (np.abs(x) - 22) ** 2
    shadow = 0.082 * np.exp(-(((y - hem - 1.4) / 3.8) ** 2))
    # Extend the brow in one clean stroke under the overhanging bangs. Small
    # disconnected samples of strand ink would travel with the skin in a turn.
    brow_rgb = np.array([105, 76, 55])
    brow_weight = (
        np.exp(-(((y - brow) / 0.85) ** 2))
        * np.clip((np.abs(x) - 10) / 4, 0, 1)
        * np.clip((36 - np.abs(x)) / 4, 0, 1)
    )
    forehead = (
        skin * (1 - shadow[..., None]) * (1 - brow_weight[..., None])
        + brow_rgb * brow_weight[..., None]
    )
    # Show the actual brow and its contact shadow wherever the skin is visible.
    # Continue that stroke beneath the fringe for a rotated view.
    visible_forehead = np.clip((y - hem + 0.5) / 2.0, 0, 1)[..., None]
    visible_forehead = (
        visible_forehead * (0.65 * np.exp(-(((y - brow) / 1.35) ** 2)))[..., None]
    )
    forehead = forehead * (1 - visible_forehead) + rgb * visible_forehead
    rgb = np.where((y < 125)[..., None], forehead, rgb)
    rgb = np.where(outside[..., None], skin, rgb)
    # The accessory and its contact point must be removed from pigment as well as geometry.
    mirrored = np.stack(
        [
            map_coordinates(front[..., c].astype(float), [y, 490 - np.abs(x)], order=1)
            for c in range(3)
        ],
        axis=-1,
    )
    stick = (x > 0) & (y >= 165)
    rgb = np.where(stick[..., None], mirrored, rgb)
    # Continue clean pigment around the turn of the jaw. Drawing ink on the
    # far side of the turn would leave a second jawline across the cheek in profile.
    blemish = (y > 139) & (
        (np.abs(x) > w - 3.7) | ((np.abs(x) > 6) & (rgb.mean(-1) < 133))
    )
    rgb = np.where(blemish[..., None], skin * np.array([0.99, 0.985, 0.974]), rgb)
    rgb = np.where(
        ((y >= 138) & (np.abs(x) > np.minimum(33, w - 4)))[..., None],
        skin * [0.987, 0.977, 0.97],
        rgb,
    )
    rgb[y >= 182] = skin * 0.93
    sharpen = np.clip((rgb - gaussian_filter(rgb, (0.68, 0.68, 0))) * 0.85, -30, 30)
    rgb = rgb + sharpen
    points, indices = _paint_rows(
        rgb.round().clip(0, 255).astype(np.uint8), rows[:, 0] - 51
    )
    ear = []
    for radius in [0, 0.37, 0.62, 0.79, 1]:
        colors = []
        for a in np.arange(14) * 2 * np.pi / 14:
            u, v = radius * np.cos(a), radius * np.sin(a)
            z = -6 + 10.6 * u * (1 - 0.22 * v) + 2.6 * v
            c = [
                int(
                    map_coordinates(
                        profile[..., ch].astype(float),
                        [[137 + v * 16.7], [200 - z]],
                        order=1,
                    )[0]
                )
                for ch in range(3)
            ]
            colors.append((c[0] << 16) | (c[1] << 8) | c[2])
        ear.append(colors)
    return {
        "orbit": _fit_orbit(front, profile),
        "ear": ear,
        "sections": rows.tolist(),
        "points": points,
        "indices": indices,
    }


def _sample_rgb(image, x, y):
    return np.array(
        [map_coordinates(image[..., c], [[y], [x]], order=1)[0] for c in range(3)],
        dtype=float,
    )


def fit_crown(front, profile, fringe):
    """Pigment along the crown meridians, registered in both drawings."""
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
        end = np.arccos(np.clip((107 - h) / 57, -0.994, 0.994))
        colors = []
        latitudes = [
            0,
            0.45,
            0.85,
            1.13,
            1.34,
            1.34 + (end - 1.34) * 0.50,
            1.34 + (end - 1.34) * 0.90,
            end,
        ]
        for i, lat in enumerate(latitudes):
            x, y, z = (
                53.04 * np.sin(lat) * np.sin(a),
                107 - 57 * np.cos(lat),
                10 + 68 * np.sin(lat) * np.cos(a),
            )

            f = _sample_rgb(front, 490 + x, y - 0.8)
            s = _sample_rgb(profile, 200 - z, y - 0.8)
            side_weight = np.clip((abs(a) - 0.75) / 0.74, 0, 1)
            c = f * (1 - side_weight) + s * side_weight
            # An ink stroke at the edge cannot darken the whole strip above it.
            floor = (
                [245, 224, 193]
                if i < 6
                else [235, 211, 180]
                if i == 6
                else [221, 189, 153]
            )
            c = np.maximum(c, floor).round().astype(int)
            colors.append((c[0] << 16) | (c[1] << 8) | c[2])
        result.append([float(a), h, *map(int, colors)])
    return result
