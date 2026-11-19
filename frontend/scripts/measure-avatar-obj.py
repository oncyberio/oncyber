"""Read a ZBrush OBJ bundle offline and export annotated shape and paint studies."""
import argparse
import io
import json
from pathlib import Path
from zipfile import ZipFile

import numpy as np
from PIL import Image, ImageDraw


def obj_parts(archive):
    for entry in archive.infolist():
        if entry.filename.lower().endswith(".zip"):
            with ZipFile(io.BytesIO(archive.read(entry))) as nested:
                yield from obj_parts(nested)
        elif entry.filename.lower().endswith(".obj"):
            yield entry.filename, archive.read(entry).splitlines()


def inspect(archive, output):
    output.mkdir(parents=True, exist_ok=True)
    parts = []
    with ZipFile(archive) as source:
        for name, lines in obj_parts(source):
            positions = np.array([line.split()[1:4] for line in lines
                                  if line.startswith(b"v ")], dtype=np.float32)
            paint = b"".join(line[6:].strip() for line in lines if line.startswith(b"#MRGB "))
            if paint:
                rgba = np.frombuffer(bytes.fromhex(paint.decode("ascii")), np.uint8).reshape(-1, 4)
                if len(rgba) != len(positions):
                    raise ValueError(f"{name}: incomplete ZBrush vertex paint")
                rgb = rgba[:, 1:]
            else:
                rgb = np.full(positions.shape, 200, dtype=np.uint8)
            parts.append((name, positions, rgb))
    all_points = np.concatenate([part[1] for part in parts])
    low, high = all_points.min(axis=0), all_points.max(axis=0)
    measurements = {}
    for name, xyz, rgb in parts:
        # Percentiles discount isolated stitches and stray vertices in a component.
        measurements[name] = dict(vertices=len(xyz), minimum=xyz.min(axis=0).tolist(),
                                  maximum=xyz.max(axis=0).tolist(),
                                  rgb_quartiles=np.percentile(rgb, [25, 50, 75], axis=0).astype(int).tolist())
    (output / "measurements.json").write_text(json.dumps(measurements, indent=2))
    views = []
    colors = np.concatenate([part[2] for part in parts])
    for title, horizontal, depth, forward in [("Front (+Z)", 0, 2, 1), ("Side (+X)", 2, 0, 1), ("Rear", 0, 2, -1)]:
        height = 740
        scale = height / (high[1] - low[1])
        width = int((high[horizontal] - low[horizontal]) * scale) + 25
        u = ((all_points[:, horizontal] - low[horizontal]) * scale + 12).astype(int)
        if forward < 0:
            u = width - 1 - u
        v = ((high[1] - all_points[:, 1]) * scale + 12).astype(int)
        image = np.full((height + 45, width, 3), [218, 212, 200], dtype=np.uint8)
        order = np.argsort(all_points[:, depth] * forward)
        # Splat the measured painted vertices, with a z order for each output pixel.
        for dy, dx in [(0, 0), (0, 1), (1, 0), (1, 1)]:
            image[v[order] + dy, u[order] + dx] = colors[order]
        frame = Image.fromarray(image)
        ImageDraw.Draw(frame).text((10, height + 24), title, fill="#372e32")
        views.append(frame)
    sheet = Image.new("RGB", (sum(im.width for im in views), views[0].height))
    x = 0
    for im in views:
        sheet.paste(im, (x, 0))
        x += im.width
    sheet.save(output / "obj-paint-study.png")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("archive", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    inspect(args.archive, args.output)
