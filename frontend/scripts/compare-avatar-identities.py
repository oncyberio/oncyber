"""Ask a frozen MobileNet V3 image encoder to match a native avatar to its original."""

import argparse
import json
from pathlib import Path
from tempfile import TemporaryDirectory
from time import monotonic

import numpy as np
from PIL import Image, ImageOps
from scipy import ndimage

from avatar_authoring.fit import bounds, pixels
from avatar_authoring.family_review import native_front
from avatar_authoring.paper_control import painted_reference
from avatar_authoring.release import digest, reference_passes, verified_captures
from avatar_authoring.turn_guides import registered_turn_pairs

# All cameras use figure height. A wider hairstyle or thinner waist must
# remain visible in the comparison. The family and identity are withheld
# from the encoder and used only when scoring its rankings.
REGIONS = {"figure": (0.5, 1.12), "head": (0.13, 0.39), "clothes": (0.60, 0.67)}


def crops(path):
    rgb, mask = pixels(path, keep_components=True)
    left, top, right, floor = bounds(mask)
    height = floor - top
    paper = (220, 220, 220)
    rgb[~mask] = paper
    image = Image.fromarray(rgb.astype(np.uint8))
    for name, (level, width) in REGIONS.items():
        x, y = (left + right) / 2, top + level * height
        half = height * width / 2
        crop = image.transform(
            (224, 224),
            Image.Transform.EXTENT,
            (x - half, y - half, x + half, y + half),
            Image.Resampling.BICUBIC,
            fillcolor=paper,
        )
        yield name, crop


def rank(gallery, actual, expected):
    if expected not in gallery or len(gallery) < 2:
        raise ValueError(
            "Identity comparison needs another drawing from the same family"
        )
    scores = {key: float(vec @ actual) for key, vec in gallery.items()}
    rivals = [k for k in scores if k != expected]
    rival = max(rivals, key=scores.get)
    return {
        "rank": 1 + sum(scores[k] >= scores[expected] - 1e-6 for k in rivals),
        "cosine": round(scores[expected], 5),
        "nearest_other": rival,
        "margin": round(scores[expected] - scores[rival], 5),
    }


def neutral_turn(frame):
    """Retain internal highlights and place only border-connected paper on gray."""
    frame = frame.astype(float)
    background = np.median(np.vstack((frame[:1], frame[-1:])), axis=(0, 1))
    near = np.max(abs(frame - background), axis=2) < 25
    border = np.zeros_like(near)
    border[[0, -1]] = near[[0, -1]]
    border[:, [0, -1]] = near[:, [0, -1]]
    frame[ndimage.binary_propagation(border, mask=near)] = 220
    return ImageOps.pad(
        Image.fromarray(frame.astype(np.uint8)),
        (224, 224),
        Image.Resampling.BICUBIC,
        color=(220, 220, 220),
    )


def score_turns(cases, guides, embed):
    # The distractors include the correct character at the other angle.
    guides = {
        key: data
        for key, data in guides.items()
        if any(
            other != key and cases[other]["family"] == cases[key]["family"]
            for other in guides
        )
    }
    vectors = {}
    for key, (review, recipe, proof) in guides.items():
        guide = proof["turn_guide"]
        item = cases[key]["turn_identity"] = {
            "guide_sha256": guide["sha256"],
            "backends": {},
        }
        for backend, capture in proof["backends"].items():
            item["backends"][backend] = {}
            for angle, filename, pair in registered_turn_pairs(
                review / "turn-guide", guide["split_x"], recipe, review / backend
            ):
                angle = str(angle)
                item["backends"][backend][angle] = {
                    "native_sha256": capture["views"][filename]
                }
                for label, (frame, _) in zip(("guide", backend), pair):
                    idx = (key, angle, label)
                    if idx not in vectors:
                        vectors[idx] = embed(neutral_turn(frame))
    for key in guides:
        item = cases[key]["turn_identity"]
        same = [k for k in guides if cases[k]["family"] == cases[key]["family"]]
        angles = ("35", "90")
        item["gallery_size"] = len(same) * len(angles)
        for backend, poses in item["backends"].items():
            for angle, receipt in poses.items():
                for mode, actual in vectors[key, angle, backend].items():
                    gallery = {
                        f"{k}/{yaw}": vectors[k, yaw, "guide"][mode]
                        for k in same
                        for yaw in angles
                    }
                    receipt[mode] = rank(gallery, actual, f"{key}/{angle}")


def compare(manifest, output, model, paper_control=False, followups=()):
    import mediapipe as mp
    from mediapipe.tasks.python import BaseOptions, vision

    start = monotonic()
    entries = json.loads(manifest.read_bytes())["cases"]
    studies = json.loads((output / "holdout.json").read_bytes())["cases"]
    folders = {c["id"]: output for c in entries}
    if followups:
        ledger = json.loads((manifest.parent / "followup-studies.json").read_bytes())
        registered = {c["id"]: c for c in ledger["cases"]}
        for key, directory in followups:
            if key not in registered or key in folders:
                raise ValueError(f"Unknown or repeated follow-up {key!r}")
            folders[key] = Path(directory)
            studies[key] = json.loads((folders[key] / "holdout.json").read_bytes())[
                "cases"
            ][key]
            entries.append(registered[key])
    result = {
        "observer": "MediaPipe MobileNet V3 image embedder",
        "version": mp.__version__,
        "weights_sha256": digest(model),
        "metric": "cosine",
        "cases": {},
    }
    images = {}
    guides = {}
    for entry in entries:
        key = entry["id"]
        row = studies[key]
        folder = folders[key] / row["study"]
        candidate = (
            folder / json.loads((folder / "study.json").read_bytes())["candidate"]
        )
        review = candidate.parent / "approval"
        evidence = verified_captures(candidate, review)
        if evidence.get("turn_guide"):
            guides[key] = review, json.loads(candidate.read_bytes()), evidence
        reference = manifest.parent / entry["evaluation_reference"]
        if (
            digest(reference) != entry["reference_sha256"]
            or evidence["reference"] != entry["reference_sha256"]
            or evidence["recipe"] != row["candidate_sha256"]
        ):
            raise ValueError(f"{key} has mismatched source or candidate evidence")
        images[key] = {
            "reference": reference,
            **{b: review / b / "front.png" for b in evidence["backends"]},
        }
        result["cases"][key] = {
            "family": entry["family"],
            "input": entry["framing"],
            "candidate_sha256": evidence["recipe"],
            "evidence_sha256": digest(review / "evidence.json"),
            "reference_sha256": evidence["reference"],
            "native_front_sha256": {
                b: v["views"]["front.png"] for b, v in evidence["backends"].items()
            },
            "backends": {},
        }
        if paper_control and entry["framing"] == "full":
            review_metrics = json.loads((candidate.parent / "review.json").read_bytes())
            registration = review_metrics["candidates"][entry["family"]]
            with TemporaryDirectory() as tmp:
                matte = Path(tmp) / "painted.png"
                control = painted_reference(reference, matte)
                control["matte_sha256"] = digest(matte)
                frames = {b: images[key][b] for b in evidence["backends"]}
                frames["first_pass"] = folder / "pass-1/front.png"
                for name, frame in frames.items():
                    raw, paint = [
                        native_front(source, frame, entry["family"], registration)
                        for source in (reference, matte)
                    ]
                    control[name] = {
                        "native_sha256": digest(frame),
                        "original": raw,
                        "painted": paint,
                        "original_passed": reference_passes("full", raw),
                        "painted_passed": reference_passes("full", paint),
                    }
                result["cases"][key]["paper_control"] = control
    with vision.ImageEmbedder.create_from_options(
        vision.ImageEmbedderOptions(
            base_options=BaseOptions(model_asset_path=str(model)), l2_normalize=True
        )
    ) as engine:

        def embed(frame):
            result = {}
            for mode, image in (
                ("color", frame),
                ("gray", ImageOps.grayscale(frame).convert("RGB")),
            ):
                response = engine.embed(
                    mp.Image(image_format=mp.ImageFormat.SRGB, data=np.asarray(image))
                )
                vector = response.embeddings[0].embedding
                length = np.linalg.norm(vector)
                if not np.isfinite(length) or length < 1e-8:
                    raise ValueError("Invalid image embedding")
                result[mode] = vector / length
            return result

        vectors = {}
        for key, paths in images.items():
            for name, path in paths.items():
                for region, frame in crops(path):
                    for mode, vector in embed(frame).items():
                        vectors[key, name, region, mode] = vector
        score_turns(result["cases"], guides, embed)
        for key, item in result["cases"].items():
            same = [
                other
                for other, c in result["cases"].items()
                if c["family"] == item["family"]
            ]
            item["family_gallery_size"] = len(same)
            for backend in item["native_front_sha256"]:
                scopes = {}
                for region in REGIONS:
                    scopes[region] = {}
                    for mode in ("color", "gray"):
                        gallery = {
                            c: vectors[c, "reference", region, mode] for c in same
                        }
                        scopes[region][mode] = rank(
                            gallery, vectors[key, backend, region, mode], key
                        )
                item["backends"][backend] = scopes
    result["seconds"] = round(monotonic() - start, 3)
    result["provider_charge_usd"] = 0
    return result


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("study", type=Path)
    parser.add_argument(
        "--paper-control",
        action="store_true",
        help="Measure how trimming exterior paper changes the original front scores",
    )
    parser.add_argument("--model", type=Path, required=True)
    parser.add_argument(
        "--followup",
        action="append",
        nargs=2,
        metavar=("ID", "STUDY"),
        help="Include a registered follow-up and its selected native study in the recognition gallery",
    )
    parser.add_argument(
        "--manifest",
        type=Path,
        default=Path(__file__).parent
        / "avatar_authoring/targets/holdout-v1/manifest.json",
    )
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    report = compare(
        args.manifest, args.study, args.model, args.paper_control, args.followup
    )
    args.output.write_text(json.dumps(report, indent=2) + "\n")
    for backend in ("WebGLBackend", "WebGPUBackend"):
        for region in REGIONS:
            print(
                backend,
                region,
                {
                    mode: sum(
                        c["backends"][backend][region][mode]["rank"] == 1
                        for c in report["cases"].values()
                    )
                    for mode in ("color", "gray")
                },
            )
