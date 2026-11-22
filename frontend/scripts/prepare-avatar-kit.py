"""Prepare the two licensed humanoids and their editable, rig-compatible shapes.

Run with the pixiv twist sample and the bundled Seed-san as the two arguments.
The source hashes and credits are recorded alongside the resulting binary files.
"""

import copy
import hashlib
import json
import sys
from io import BytesIO
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

FRONTEND = Path(__file__).resolve().parents[1]
KINDS = {5123: "<u2", 5125: "<u4", 5126: "<f4", 5121: "u1"}
DIMS = {"VEC2": 2, "VEC3": 3, "VEC4": 4, "SCALAR": 1}


def smooth(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


class Source:
    def __init__(self, path, checksum):
        data = path.read_bytes()
        if hashlib.sha256(data).hexdigest() != checksum:
            raise ValueError(f"Unexpected source revision: {path.name}")
        n = int.from_bytes(data[12:16], "little")
        self.g = json.loads(data[20 : 20 + n])
        binary = data[28 + n :]
        self.views = [
            binary[v.get("byteOffset", 0) : v.get("byteOffset", 0) + v["byteLength"]]
            for v in self.g["bufferViews"]
        ]

    def array(self, i):
        a = self.g["accessors"][i]
        assert not self.g["bufferViews"][a["bufferView"]].get("byteStride")
        return np.frombuffer(
            self.views[a["bufferView"]],
            KINDS[a["componentType"]],
            offset=a.get("byteOffset", 0),
            count=a["count"] * DIMS[a["type"]],
        ).reshape(a["count"], -1)

    def view(self, data):
        i = len(self.views)
        self.views.append(data)
        self.g["bufferViews"].append({"buffer": 0, "byteLength": len(data)})
        return i

    def attribute(self, a, kind, component):
        a = np.ascontiguousarray(a, dtype=KINDS[component])
        record = {
            "bufferView": self.view(a.tobytes()),
            "componentType": component,
            "count": len(a),
            "type": kind,
        }
        if kind == "VEC3":
            record.update(min=a.min(axis=0).tolist(), max=a.max(axis=0).tolist())
        self.g["accessors"].append(record)
        return len(self.g["accessors"]) - 1

    def target(self, delta):
        used = np.flatnonzero(np.max(abs(delta), axis=1) > 1e-7)
        record = {
            "componentType": 5126,
            "type": "VEC3",
            "count": len(delta),
            "min": np.minimum(0, delta.min(axis=0)).tolist(),
            "max": np.maximum(0, delta.max(axis=0)).tolist(),
        }
        if len(used):
            record["sparse"] = {
                "count": len(used),
                "indices": {
                    "bufferView": self.view(used.astype("<u2").tobytes()),
                    "componentType": 5123,
                },
                "values": {
                    "bufferView": self.view(delta[used].astype("<f4").tobytes())
                },
            }
        self.g["accessors"].append(record)
        return len(self.g["accessors"]) - 1

    def image(self, i):
        return Image.open(
            BytesIO(self.views[self.g["images"][i]["bufferView"]])
        ).convert("RGBA")

    def replace_image(self, i, im):
        dest = BytesIO()
        opaque = im.getextrema()[-1][0] == 255
        if opaque:
            im.convert("RGB").save(dest, format="JPEG", quality=92, subsampling=0)
        else:
            im.save(dest, format="PNG", optimize=True)
        rec = self.g["images"][i]
        self.views[rec["bufferView"]] = dest.getvalue()
        rec["mimeType"] = "image/jpeg" if opaque else "image/png"

    def finish(self, name):
        data = bytearray()
        for view, raw in zip(self.g["bufferViews"], self.views, strict=True):
            data.extend(bytes(-len(data) % 4))
            view.update(byteOffset=len(data), byteLength=len(raw))
            data.extend(raw)
        folder = FRONTEND / "public/avatar-kit"
        file = f"{name}-{hashlib.sha256(data).hexdigest()[:10]}.bin"
        (folder / file).write_bytes(data)
        self.g["buffers"] = [{"uri": "/avatar-kit/" + file, "byteLength": len(data)}]
        (FRONTEND / f"features/avatar-builder/templates/{name}.json").write_text(
            json.dumps(self.g, separators=(",", ":")) + "\n"
        )
        print(name, file, len(data))


def neutral(im, kind):
    rgba = np.asarray(im).copy()
    y = rgba[:, :, :3] @ [0.2126, 0.7152, 0.0722]
    if kind == "fiber":
        grey = 255 * np.minimum(1, (y / 94) ** 0.63)
    elif kind == "darkFiber":
        grey = 255 * np.minimum(1, (y / 56) ** 0.65)
    else:
        grey = 255 * np.minimum(1, (y / 185) ** 0.76)
    rgba[:, :, :3] = grey[:, :, None]
    return Image.fromarray(rgba)


def jersey(source, prim, image, kit):
    """Print in garment space, then rasterize into the shirt's original UV islands."""
    n = 768
    im = np.asarray(image.resize((n, n), Image.Resampling.LANCZOS)).copy()
    pos = source.array(prim["attributes"]["POSITION"])
    uv = source.array(prim["attributes"]["TEXCOORD_0"]) * n
    tris = source.array(prim["indices"]).reshape(-1, 3)
    sign = Image.new("L", (320, 300))
    pen = ImageDraw.Draw(sign)
    font = ImageFont.truetype("DejaVuSans-Bold.ttf", 164)
    pen.text(
        (160, 158),
        "07",
        font=font,
        anchor="mm",
        fill=238,
        stroke_width=3,
        stroke_fill=255,
    )
    pen.text(
        (160, 63),
        "O N C Y B E R",
        font=ImageFont.truetype("DejaVuSans-Bold.ttf", 24),
        anchor="mm",
        fill=235,
    )
    stamp = np.asarray(sign)
    for ids in tris:
        a, b, c = uv[ids]
        lo = np.maximum(0, np.floor(uv[ids].min(0) - 1).astype(int))
        hi = np.minimum(n, np.ceil(uv[ids].max(0) + 1).astype(int))
        if (hi <= lo).any():
            continue
        yy, xx = np.mgrid[lo[1] : hi[1], lo[0] : hi[0]]
        dx = xx + 0.5 - a[0]
        dy = yy + 0.5 - a[1]
        e = b - a
        f = c - a
        det = e[0] * f[1] - e[1] * f[0]
        if abs(det) < 1e-8:
            continue
        s = (dx * f[1] - dy * f[0]) / det
        t = (e[0] * dy - e[1] * dx) / det
        hit = (s >= -0.012) & (t >= -0.012) & (s + t <= 1.012)
        x, y, z = (
            pos[ids[0]]
            + (pos[ids[1]] - pos[ids[0]]) * s[..., None]
            + (pos[ids[2]] - pos[ids[0]]) * t[..., None]
        ).transpose(2, 0, 1)
        if kit == 1:
            cuff = (np.abs(x) > 0.255) & ((np.abs(x) < 0.268) | (np.abs(x) > 0.286))
            trim = np.maximum(cuff * 0.86, (y < 0.851) * 0.86)
            sx = np.clip(((x / 0.225 + 0.5) * 320).astype(int), 0, 319)
            sy = np.clip(((1.281 - y) / 0.225 * 300).astype(int), 0, 299)
            trim = np.maximum(trim, stamp[sy, sx] / 255 * (z > 0.055))
        else:
            side = np.abs(x)
            trim = np.maximum(
                (abs(y - 1.20 + side * 0.46) < 0.012) * 0.91,
                (abs(y - 1.171 + side * 0.46) < 0.005) * 0.7,
            )
            trim = np.maximum(trim, ((side > 0.272) | (y < 0.849)) * 0.84)
        patch = im[lo[1] : hi[1], lo[0] : hi[0], :3]
        dyed = patch * (1 - trim[..., None]) + np.array([36, 40, 58]) * trim[..., None]
        patch[hit] = dyed[hit].astype("u1")
    return Image.fromarray(im)


def prepare(name, path, checksum):
    src = Source(path, checksum)
    g = src.g
    academy = name == "atelier"
    # Share the iris tint only with iris triangles. The field rig's painted
    # face parts share a material and texture with the mouth and eyebrows.
    if not academy:
        face = g["meshes"][2]
        p = face["primitives"][1]
        tris = src.array(p["indices"]).reshape(-1, 3)
        uv = src.array(p["attributes"]["TEXCOORD_0"])
        parents = list(range(len(uv)))

        def root(i):
            while i != parents[i]:
                parents[i] = parents[parents[i]]
                i = parents[i]
            return i

        for a, b, c in tris:
            parents[root(a)] = root(b)
            parents[root(c)] = root(b)
        groups = np.array([root(i) for i in range(len(uv))])
        irises = []
        for group in np.unique(groups):
            island = uv[groups == group]
            if np.ptp(island[:, 1]) > 0.48 and island[:, 1].max() < 0.71:
                irises.append(group)
        assert len(irises) == 2
        mask = np.isin(groups[tris[:, 0]], irises)
        iris = copy.deepcopy(g["materials"][3])
        iris["name"] = "field_iris"
        image = src.image(7)
        normalized = neutral(image, "iris")
        img = {"name": "field_iris", "bufferView": src.view(b"")}
        g["images"].append(img)
        src.replace_image(len(g["images"]) - 1, normalized)
        tx = len(g["textures"])
        g["textures"].append({**g["textures"][7], "source": len(g["images"]) - 1})
        iris["pbrMetallicRoughness"]["baseColorTexture"]["index"] = tx
        iris["extensions"]["VRMC_materials_mtoon"]["shadeMultiplyTexture"]["index"] = tx
        new = {
            **copy.deepcopy(p),
            "material": len(g["materials"]),
            "indices": src.attribute(tris[mask].ravel(), "SCALAR", 5123),
        }
        g["materials"].append(iris)
        p["indices"] = src.attribute(tris[~mask].ravel(), "SCALAR", 5123)
        face["primitives"].append(new)
    for i in range(19 if academy else 15):
        im = src.image(i)
        im.thumbnail(
            (1024, 1024)
            if i in ([9, 15, 8] if academy else [0, 2, 4, 7])
            else (768, 768),
            Image.Resampling.LANCZOS,
        )
        if academy and i in [5, 13, 15]:
            im = neutral(im, "fiber")
        if not academy and i == 0:
            im = neutral(im, "darkFiber")
        if academy and i == 8:
            im = neutral(im, "iris")
        src.replace_image(i, im)
    mats = g["materials"]
    for m in mats:
        k = m["name"]
        slot = None
        if k in ["hair", "Hair_00_HAIR", "HairBack_00_HAIR", "FaceBrow_00_FACE"]:
            slot = "hair"
        elif k in ["EyeIris_00_EYE", "field_iris"]:
            slot = "eyes"
        elif k in ["body_bake", "body_nm", "Body_00_SKIN", "Face_00_SKIN"]:
            slot = "skin"
        elif k in ["huku_bake", "Tops_01_CLOTH"]:
            slot = "fabric"
        if slot:
            m.setdefault("extras", {})["studioColor"] = slot
    for me in g["meshes"]:
        mesh = me["name"]
        head = mesh == ("Face" if academy else "head")
        names = me.setdefault("extras", {}).setdefault("targetNames", [])
        adjustable = (
            ["Jaw", "Eyes", "Cheeks", "Nose", "Spacing"]
            if head
            else ["Hair"]
            if mesh in ["Hair", "hair_tail"]
            else ["Frame"]
            if mesh in ["Body", "wear"]
            else []
        )
        names.extend("Studio" + k for k in adjustable)
        for p in me["primitives"]:
            pos = src.array(p["attributes"]["POSITION"])
            x, y, z = pos.T
            for key in adjustable:
                d = np.zeros_like(pos)
                if key == "Jaw":
                    chin = 1.354 if academy else 1.303
                    eye = 1.444 if academy else 1.427
                    w = (
                        (1 - smooth(chin + 0.016, eye - 0.004, y))
                        * smooth(chin - 0.024, chin + 0.005, y)
                        * smooth(-0.065, -0.015, z)
                    )
                    d[:, 0] = x * 0.22 * w
                    d[:, 1] = -0.007 * w
                elif key == "Eyes":
                    h = 1.444 if academy else 1.423
                    cx = 0.036 if academy else 0.038
                    w = np.exp(
                        -(((abs(x) - cx) / 0.031) ** 4) - ((y - h) / 0.028) ** 4
                    ) * smooth(0.017, 0.045, z)
                    d[:, 1] = (y - h) * 0.37 * w
                    d[:, 0] = (x - np.sign(x) * cx) * 0.14 * w
                elif key == "Cheeks":
                    cheek_y = 1.415 if academy else 1.383
                    w = np.exp(
                        -(((y - cheek_y) / 0.032) ** 2)
                        - ((abs(x) - 0.067) / 0.032) ** 2
                    ) * smooth(-0.045, 0.025, z)
                    d[:, 0] = 0.012 * np.sign(x) * w
                    d[:, 2] = 0.006 * w
                elif key == "Nose":
                    tip = 1.408 if academy else 1.380
                    w = np.exp(-((x / 0.018) ** 2) - ((y - tip) / 0.022) ** 2)
                    d[:, 2] = 0.014 * w * smooth(0.045, 0.07, z)
                elif key == "Spacing":
                    eye = 1.444 if academy else 1.423
                    w = np.exp(
                        -(((y - eye) / 0.048) ** 4) - ((abs(x) - 0.042) / 0.039) ** 4
                    )
                    d[:, 0] = (
                        0.006
                        * np.sign(x)
                        * w
                        * smooth(0.008, 0.036, z)
                        * smooth(0, 0.016, abs(x))
                    )
                elif key == "Hair":
                    root = 1.429 if academy else 1.339
                    w = np.maximum(root - y, 0)
                    d[:, 1] = 0.84 * w
                    d[:, 0] = (-x * 0.27 if academy else (-0.005 - x) * 0.67) * smooth(
                        0, 0.16, w
                    )
                    d[:, 2] = (-0.055 - z) * smooth(0, 0.2, w) * 0.28
                elif key == "Frame":
                    w = (
                        smooth(0.69, 0.87, y)
                        * (1 - smooth(1.22, 1.36, y))
                        * (1 - smooth(0.16, 0.32, abs(x)))
                    )
                    d[:, 0] = x * 0.21 * w
                    d[:, 2] = z * 0.15 * w
                p.setdefault("targets", []).append({"POSITION": src.target(d)})
            # Pigment carries a restrained key light through unlit VRM paths.
            normals = src.array(p["attributes"]["NORMAL"])
            side = np.clip(normals @ [-0.38, 0.57, 0.72], -1, 1)
            shade = 0.82 + 0.18 * smooth(-0.65, 0.85, side)
            rgb = np.stack([shade**0.65, shade, shade**1.18], axis=1)
            # A normalized byte per channel has enough precision for these small
            # pigment variations. VEC4 keeps every vertex aligned in glTF.
            rgba = np.column_stack((rgb, np.ones(len(rgb))))
            color = src.attribute(np.rint(rgba * 255), "VEC4", 5121)
            g["accessors"][color]["normalized"] = True
            p["attributes"]["COLOR_0"] = color
        if adjustable:
            me["weights"] = [0] * len(names)
    if academy:
        body = g["meshes"][0]
        p = next(p for p in body["primitives"] if p["material"] == 3)
        mats[3]["extras"]["studioKit"] = 0
        original = src.image(4)
        for kit in [1, 2]:
            m = copy.deepcopy(mats[3])
            m["name"] = f"studio_shirt_{kit}"
            m["extras"]["studioKit"] = kit
            g["images"].append({"name": m["name"], "bufferView": src.view(b"")})
            src.replace_image(len(g["images"]) - 1, jersey(src, p, original, kit))
            tx = len(g["textures"])
            g["textures"].append({**g["textures"][4], "source": len(g["images"]) - 1})
            m["pbrMetallicRoughness"]["baseColorTexture"]["index"] = tx
            m["extensions"]["VRMC_materials_mtoon"]["shadeMultiplyTexture"]["index"] = (
                tx
            )
            body["primitives"].append({**p, "material": len(mats)})
            mats.append(m)
    else:
        for m in mats:
            if m["name"].startswith("backpack") or m["name"] == "anim_logo":
                m.setdefault("extras", {})["studioGear"] = 1
            if m["name"] in ["arm_mat", "arm_plastic"]:
                m.setdefault("extras", {})["studioGear"] = 2
        # The antenna and the pack both use the emissive material.
        for mesh in g["meshes"]:
            for p in mesh["primitives"]:
                mat = mats[p["material"]]
                if (
                    mat["name"] == "green_emit"
                    or mesh["name"] == "hair_tail"
                    or (mesh["name"] == "hair" and mat["name"] == "huku_bake")
                ):
                    m = copy.deepcopy(mat)
                    m["name"] = mesh["name"] + "_" + mat["name"]
                    m.setdefault("extras", {})[
                        "studioGear" if mat["name"] == "green_emit" else "studioTail"
                    ] = (
                        (2 if mesh["name"] == "robo_arm" else 1)
                        if mat["name"] == "green_emit"
                        else True
                    )
                    p["material"] = len(mats)
                    mats.append(m)
    src.finish(name)


if __name__ == "__main__":
    prepare(
        "atelier",
        Path(sys.argv[1]),
        "12c2b97e95e700783a6a550dc0eee2d7880aeedccef9ae67bc4c5a2f0f2631a2",
    )
    prepare(
        "relay",
        Path(sys.argv[2]),
        "624d0d554bc205bbdc33e22a68a2c3c20edebb3e573011ead8878a65e5329b23",
    )
