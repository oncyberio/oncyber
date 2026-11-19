"""Reuse reviewed compositions of native parts on later members of the same family."""

import json
import re
from pathlib import Path

from .family_edits import edited_recipe


def library_key(name):
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    if not 1 <= len(slug) <= 64:
        raise ValueError("Name a visible feature in at most 64 characters")
    return slug


def location(library, recipe, name):
    return (
        library
        / recipe["family"]
        / recipe.get("construction", "registered")
        / (library_key(name) + ".json")
    )


def apply_feature(recipe, definition):
    if (definition["family"], definition["construction"]) != (
        recipe["family"],
        recipe.get("construction", "registered"),
    ):
        raise ValueError("This feature belongs to another family construction")
    edits = definition["edits"]
    if not 1 <= len(edits) <= 4:
        raise ValueError("A reusable feature must use one to four native parts")
    for edit in edits:
        if (
            edit["value"] is None
            or isinstance(edit["value"], dict)
            and "sample" in edit["value"]
        ):
            raise ValueError("Save the actual fitted part, including its geometry")
        if edit["field"] not in {
            "design.household.headband",
            "design.household.eyePatch",
            "design.outfit.buttons",
            "design.outfit.buttonColor",
            "design.outfit.placketDepth",
            "design.outfit.top",
            "shirtMark",
            "sunRays",
            "orbCollar",
            "visor",
            "crownOutline",
        }:
            raise ValueError("The requested feature needs a new native part")
    return edited_recipe(recipe, edits)


def register_feature(library, feature, candidate, release):
    from .release import require_release

    require_release(candidate, release)
    recipe = json.loads(candidate.read_bytes())
    definition = json.loads(feature.read_bytes())
    if apply_feature(recipe, definition) != recipe:
        raise ValueError("The approved recipe does not contain this exact feature")
    target = location(library, recipe, definition["name"])
    target.parent.mkdir(parents=True, exist_ok=True)
    # Hard-link a complete file into place. Concurrent authors can safely
    # propose the same part and conflicting definitions retain their own study.
    import os
    import tempfile

    with tempfile.NamedTemporaryFile(dir=target.parent, mode="w") as staged:
        json.dump(definition, staged, indent=2)
        staged.write("\n")
        staged.flush()
        try:
            os.link(staged.name, target)
        except FileExistsError:
            if json.loads(target.read_bytes()) != definition:
                raise ValueError("A different feature already uses this name")
    return target


def resolve_feature(args, name, recipe, source, folder, receipts):
    from copy import copy
    from .family_edits import edit_schema, record
    from .provider import openrouter_model, request_drawing

    library = getattr(args, "feature_library", None)
    target = location(library, recipe, name) if library else None
    if target and target.exists():
        return apply_feature(recipe, json.loads(target.read_bytes()))
    if any(call.get("operation") == "compose_native_part" for call in receipts):
        raise ValueError(
            f"The study already used its one family extension; still missing {name}"
        )
    if not getattr(args, "feature_model", None):
        raise ValueError(f"Family needs a reusable feature: {name}")
    strong = copy(args)
    strong.model = (
        openrouter_model(args.feature_model) if args.openrouter else args.feature_model
    )
    construction = recipe.get("construction", "registered")
    operation = {
        "type": "function",
        "name": "compose_native_part",
        "strict": True,
        "description": "Compose the named visible feature from available native geometry.",
        "parameters": record({"edits": edit_schema(recipe["family"], construction)}),
    }
    prompt = (
        f"Fit only the visible feature {name!r} for this {recipe['family']} {construction} avatar. "
        "Use one to four native edits for a headband, eye patch, buttoned polo, chest emblem, crown, visor, jersey collar or rays. "
        "Give transferable local coordinates and pigments. Return no edits if it requires another geometry primitive. "
        f"The current drawing is {json.dumps(recipe)}"
    )
    answer, receipt = request_drawing(strong, prompt, [source], [operation], operation)
    receipts.append({**receipt, "operation": operation["name"]})
    feature = {
        "name": library_key(name),
        "family": recipe["family"],
        "construction": construction,
        "edits": answer["edits"],
    }
    result = apply_feature(recipe, feature)
    (folder / "feature.json").write_text(json.dumps(feature, indent=2) + "\n")
    return result
