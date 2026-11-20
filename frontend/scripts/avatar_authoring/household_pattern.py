"""Measure the fitted drawing pattern independently of a native render."""

import json
import subprocess
from pathlib import Path

import numpy as np


def measure(recipe):
    script = Path(__file__).with_name("measure-household-pattern.cjs")
    result = subprocess.run(
        ["node", str(script)],
        input=json.dumps(recipe).encode(),
        capture_output=True,
        check=True,
    )
    return json.loads(result.stdout)


def bilateral_offset(observed, projected):
    if observed is None or projected is None:
        return None
    delta = np.subtract(observed, projected)
    if np.prod(delta) > 0 and np.ptp(delta) < 2 and 0.8 < abs(delta.mean()) <= 7:
        return round(float(delta.mean()), 2)


def fit_arm_height(recipe, source):
    from .inked_hand import arm_centerlines
    from .family_edits import edited_recipe

    design = recipe["design"]
    body = design["household"].get("body")
    if not body or not body["sections"].get("palmContours"):
        return recipe
    source_levels = arm_centerlines(source, body, design["height"])
    if source_levels is not None:
        rows = measure(recipe).get("forearms")
        if rows and all(len(levels) >= 4 for levels in rows):
            shift = bilateral_offset(source_levels, [np.median(side) for side in rows])
            if shift:
                return edited_recipe(
                    recipe, [{"field": "armHeightOffset", "value": shift}]
                )
    return recipe
