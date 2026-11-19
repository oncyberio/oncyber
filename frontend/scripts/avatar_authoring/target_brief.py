"""Prepare a GPT Image reference and variation brief from a native family."""

import json
from pathlib import Path
from tempfile import mkdtemp

from .review import render

CONSTRUCTION = {
    "sunshine": "Keep a detached spherical head with visible air above its jersey, individual triangular rays, a wraparound visor with two pale marks, the printed sports jersey, shorts, socks and trainers. You may vary the orb's two hues, ray positions, body proportions and kit lengths.",
    "rick-classic": "Keep the scientist's forward jaw, separate white eye globes with centered dark pupils, pointed 3D crown, open mouth, round-neck shirt, open lab coat and thin trouser legs. You may vary the proportions, crown shape, pigments, coat opening and one simple shirt emblem.",
}


def prepare_target(family, variation, output, base, backend):
    output.mkdir(parents=True, exist_ok=True)
    folder = Path(mkdtemp(prefix="target-", dir=output)).resolve()
    recipe = {
        "version": 1,
        "style": "family",
        "family": family,
        "name": family,
        "proportions": {},
        "paints": {},
    }
    model = folder / "base.json"
    model.write_text(json.dumps(recipe) + "\n")
    render(model, folder, base, False, backend)
    prompt = (
        "Create one original character in the same family as the attached native model sheet. "
        "Draw a full-body orthographic front T-pose. Center both visible hands and both feet "
        "on uniform contrasting paper, with clean edges and soft contact shading. "
        + CONSTRUCTION[family]
        + " Character brief: "
        + variation.strip()
    )
    request = {
        "prompt": prompt,
        "referenced_image_paths": [str(folder / "front.png")],
        "transparent_background": False,
    }
    path = folder / "imagegen-request.json"
    path.write_text(json.dumps(request, indent=2) + "\n")
    return path
