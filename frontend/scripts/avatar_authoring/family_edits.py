"""Bounded edits to a native family member, shared by the provider and MCP."""

import copy
import itertools
import json
import math

from jsonschema import Draft202012Validator

from .family import FAMILIES
from .tracing import garment_motif, traced_print, validate_outline


def record(properties):
    return {
        "type": "object",
        "properties": properties,
        "required": list(properties),
        "additionalProperties": False,
    }


def edit_schema(family=None, construction=None):
    families = [FAMILIES[family]] if family else list(FAMILIES.values())
    roles = sorted({f"paints.{role}" for spec in families for role in spec["paints"]})
    scale = {"type": "number", "minimum": 0.65, "maximum": 1.5}
    color = {"type": "string", "pattern": "^#[a-fA-F0-9]{6}$"}
    names = ["build", "legLength", "headHeight", "jaw"]
    if family != "sunshine":  # The mascot's visor pigments share its head surface.
        names.append("eyes")

    def fields(names, value):
        return record({"field": {"type": "string", "enum": names}, "value": value})

    def bounded(lo, hi):
        return {"type": "number", "minimum": lo, "maximum": hi}

    def pair(low, high):
        return {
            "type": "array",
            "minItems": 2,
            "maxItems": 2,
            "items": {"type": "number", "minimum": low, "maximum": high},
        }

    branches = [
        fields(["proportions.armSpan"], bounded(0.8, 1.25)),
        fields(
            ["proportions.headWidth"],
            bounded(0.65, 1.8 if family == "sunshine" else 1.5),
        ),
        fields(
            ["limbWidth"],
            record({"arms": bounded(0.72, 1.4), "legs": bounded(0.72, 1.4)}),
        ),
        fields(["proportions." + key for key in names], scale),
        fields(
            ["proportions.crownLength"],
            {"type": "number", "minimum": 0.45, "maximum": 1.65},
        ),
        fields(
            ["proportions.crownProfile"],
            {
                "type": "array",
                "minItems": 8,
                "maxItems": 8,
                "items": {"type": "number", "minimum": 0.5, "maximum": 1.5},
            },
        ),
        fields(roles, color),
    ]
    if families:
        point = {
            "type": "array",
            "minItems": 2,
            "maxItems": 2,
            "items": {"type": "number", "minimum": 0, "maximum": 1},
        }
        outline_point = {
            **point,
            "items": {"type": "number", "minimum": -0.5, "maximum": 1.5},
        }
        contour = {
            "type": "array",
            "items": outline_point,
            "minItems": 3,
            "maxItems": 32,
        }
        mark = {"color": color, "outline": contour}
        islands = {"type": "array", "items": contour, "minItems": 1, "maxItems": 4}
        branches.append(
            fields(
                ["shirtMark"],
                {
                    "anyOf": [
                        record(mark),
                        record({**mark, "islands": islands}),
                        record({"sample": point}),
                        {"type": "null"},
                    ]
                },
            )
        )
    if family != "rick-classic":
        kit = {
            k: bounded(-0.045, 0.045)
            for k in ("collar", "shoulders", "waist", "hem", "sock")
        }
        fit = record({**kit, "width": bounded(0.78, 1.25)})
        # Published fits predate the separately observed upper-shirt width.
        fit["properties"]["chestWidth"] = bounded(0.70, 1.30)
        fit["properties"]["jerseySides"] = {
            "type": "array",
            "minItems": 3,
            "maxItems": 3,
            "items": bounded(0.65, 1.32),
        }
        branches.append(fields(["kitFit"], fit))
        branches.append(
            fields(
                ["shortsCut"],
                {
                    "anyOf": [
                        record(
                            {
                                "rise": bounded(0.20, 0.93),
                                "hemSpan": bounded(0.75, 1.32),
                            }
                        ),
                        record(
                            {
                                "rise": bounded(0.20, 0.93),
                                "hemSpan": bounded(0.75, 1.32),
                                "hemGap": bounded(0.025, 0.42),
                            }
                        ),
                    ]
                },
            )
        )
        branches.append(fields(["orbPaint"], record({"top": color, "bottom": color})))
        branches.append(
            fields(
                ["orbCollar"],
                record(
                    {
                        "radius": bounded(0.16, 0.43),
                        "drop": bounded(0.04, 0.24),
                        "band": bounded(0.02, 0.12),
                        "binding": color,
                        "skin": color,
                    }
                ),
            )
        )
        branches.append(
            fields(
                ["visor"],
                {"anyOf": [{"type": "string", "enum": ["trace"]}, {"type": "null"}]},
            )
        )
        branches.append(fields(["orbOffset"], pair(-0.35, 0.35)))
        branches.append(
            fields(
                ["sunRays"],
                {
                    "type": "array",
                    "minItems": 5,
                    "maxItems": 24,
                    "items": {
                        "type": "array",
                        "minItems": 3,
                        "maxItems": 6,
                        "items": pair(-2.8, 2.8),
                    },
                },
            )
        )
    if family != "sunshine":

        def scale_range(low, high):
            return {"type": "number", "minimum": low, "maximum": high}

        # Use a homogeneous pair for hosted JSON Schema. The local validator
        # additionally checks that the vertical coordinate stays on the lapel.
        knot = {"type": "array", "minItems": 2, "maxItems": 2, "items": bounded(-1, 1)}
        path = {"type": "array", "minItems": 3, "maxItems": 18, "items": knot}
        branches.append(
            fields(
                ["sleeveCut"],
                record({"radius": bounded(0.72, 1.32), "lift": bounded(-5, 5)}),
            )
        )
        branches.append(
            fields(
                ["lapels"],
                record(
                    {
                        "color": color,
                        "paths": {
                            "type": "array",
                            "minItems": 2,
                            "maxItems": 2,
                            "items": path,
                        },
                    }
                ),
            )
        )
        branches.append(
            fields(
                ["coatPanels"],
                record(
                    {
                        "opening": {
                            "type": "array",
                            "minItems": 7,
                            "maxItems": 7,
                            "items": bounded(0.24, 0.90),
                        },
                        "lining": color,
                    }
                ),
            )
        )
        branches.append(
            fields(
                ["coatFit"],
                record(
                    {
                        "hem": bounded(0.85, 1.18),
                        "widths": {
                            "type": "array",
                            "minItems": 4,
                            "maxItems": 4,
                            "items": bounded(0.75, 1.35),
                        },
                    }
                ),
            )
        )
        branches.append(fields(["penOutline"], {"type": "boolean"}))
        branches.append(fields(["eyeInk"], {"anyOf": [color, {"type": "null"}]}))
        branches.append(
            fields(
                ["eyeShape"],
                record(
                    {
                        "width": scale_range(0.7, 1.5),
                        "height": scale_range(0.7, 1.5),
                        "lift": scale_range(-0.55, 0.55),
                        "pupil": scale_range(0.65, 2.2),
                    }
                ),
            )
        )
        branches.append(
            fields(
                ["crownOutline"],
                {
                    "anyOf": [
                        {"type": "null"},
                        {
                            "type": "array",
                            "minItems": 8,
                            "maxItems": 80,
                            "items": {
                                "type": "array",
                                "minItems": 2,
                                "maxItems": 2,
                                "items": scale_range(-4, 4),
                            },
                        },
                    ]
                },
            )
        )
    if family != "sunshine" and construction in (None, "household"):
        household = [
            fields(["armHeightOffset"], bounded(-7, 7)),
            fields(["shirtSideOffset"], pair(-7, 7)),
            fields(
                [
                    "design.skin",
                    "design.hair.color",
                    "design.outfit.color",
                    "design.outfit.trim",
                    "design.outfit.trousers",
                    "design.outfit.shoes",
                ],
                color,
            ),
            fields(
                ["design.household.eyePatch"],
                {
                    "anyOf": [
                        record(
                            {
                                "side": {"type": "string", "enum": ["left", "right"]},
                                "color": color,
                                "strap": color,
                                "width": bounded(0.10, 0.30),
                                "height": bounded(0.07, 0.26),
                                "lift": bounded(-0.22, 0.16),
                            }
                        ),
                        {"type": "null"},
                    ]
                },
            ),
            fields(
                ["design.household.headband"],
                {
                    "anyOf": [
                        record(
                            {
                                "color": color,
                                "width": bounded(0.015, 0.24),
                                "tilt": bounded(-0.65, 0.75),
                            }
                        ),
                        {"type": "null"},
                    ]
                },
            ),
            fields(["design.face.eyeHeight"], bounded(0.2, 0.65)),
            fields(["design.outfit.buttonColor"], {"anyOf": [color, {"type": "null"}]}),
            fields(
                ["design.outfit.placketDepth"],
                {"anyOf": [bounded(0.1, 0.4), {"type": "null"}]},
            ),
            fields(
                ["design.outfit.placketEnd"],
                {"anyOf": [bounded(0.1, 1), {"type": "null"}]},
            ),
            fields(
                ["design.outfit.buttons"],
                {
                    "anyOf": [
                        {
                            "type": "array",
                            "items": bounded(0.1, 0.96),
                            "minItems": 1,
                            "maxItems": 6,
                        },
                        {"type": "null"},
                    ]
                },
            ),
            fields(["design.face.eyeSpacing"], bounded(0.12, 0.33)),
            fields(["design.face.eyeRadius"], bounded(0.085, 0.24)),
            fields(["design.face.eyeAspect"], bounded(0.28, 1.18)),
            fields(["design.pupil.radius"], bounded(0.06, 0.24)),
            fields(["design.face.noseProjection"], bounded(0.72, 1.55)),
            fields(
                ["design.hair.cut"],
                {"type": "string", "enum": ["crop", "part", "ponytail", "waves"]},
            ),
            fields(
                ["design.outfit.top"],
                {"type": "string", "enum": ["crew", "tank", "polo"]},
            ),
        ]
        branches = household if construction == "household" else branches + household
    return {"type": "array", "items": {"anyOf": branches}, "maxItems": 12}


REVISION_TOOL = {
    "name": "revise_avatar_family",
    "description": "Adjust a rendered family candidate using its recipe hash and named fields. "
    "Set absolute values. A plain shirt can take one filled outline in shirt-local "
    "[0,1] coordinates, x right and y down. Use {sample:[u,v]} to trace the "
    "connected pigment under a point on the source, or null to remove the mark. "
    "The native renderer checks the edited recipe against the same T-pose.",
    "inputSchema": record(
        {
            "base_recipe_sha256": {"type": "string", "pattern": "^[0-9a-f]{64}$"},
            "edits": {**edit_schema(), "minItems": 1},
        }
    ),
}


def edited_recipe(
    base, edits, source_patch=None, print_window=(0, 0, 1, 1), visor_from_source=None
):
    json.dumps(edits, allow_nan=False)
    schema = edit_schema(base["family"], base.get("construction", "registered"))
    for problem in Draft202012Validator(schema).iter_errors(edits):
        raise ValueError(
            f"Invalid family edit at {problem.json_path}: {problem.message}"
        )
    recipe = copy.deepcopy(base)
    seen = set()
    for edit in edits:
        field, value = edit["field"], edit["value"]
        if field in seen:
            raise ValueError(f"Repeated family field {field}")
        seen.add(field)
        if field == "armHeightOffset":
            body = recipe["design"]["household"].get("body")
            if not body or not body.get("sections", {}).get("arm"):
                raise ValueError("Arm elevation requires measured T-pose arms")
            for row in body["sections"]["arm"]:
                row[1] = round(row[1] + value, 2)
                if not 0 <= row[1] <= 950:
                    raise ValueError("Arm elevation is outside the drawing")
        elif field == "shirtSideOffset":
            body = recipe["design"]["household"].get("body")
            sections = body and body["sections"]
            cut = sections and sections.get("shirtCut")
            if not cut or len(cut["centers"]) != len(sections["torso"]):
                raise ValueError("Shirt side offsets require a fitted sleeve and torso")
            station = next(
                (
                    row
                    for row in sections["arm"]
                    if row[0] == cut["station"] and row[0] <= sections["sleeve"]
                ),
                None,
            )
            if station is None:
                raise ValueError("Shirt shoulder must join a fitted sleeve")
            for i, row in enumerate(sections["torso"]):
                # Carry the chest up to the sleeve join, leaving the neck intact.
                t = min(1, max(0, (row[0] - station[1]) / station[2]))
                row[1] = round(row[1] + (value[1] - value[0]) * 0.5 * t, 2)
                cut["centers"][i] = round(cut["centers"][i] + sum(value) * 0.5 * t, 2)
                if not 2 <= row[1] <= 140 or abs(cut["centers"][i]) > 42:
                    raise ValueError("Fitted shirt edges are outside the torso")
        elif field.startswith("design."):
            if (
                field == "design.hair.cut"
                and value == "waves"
                and not recipe["design"]["household"].get("fallRows")
                and not recipe["design"]["household"].get("measuredBob")
            ):
                raise ValueError(
                    "Shoulder-length hair requires a measured cap and nape or fall rows"
                )
            target = recipe
            *path, key = field.split(".")
            for section in path:
                target = target[section]
            if (
                field
                in (
                    "design.household.eyePatch",
                    "design.household.headband",
                    "design.outfit.buttons",
                    "design.outfit.buttonColor",
                    "design.outfit.placketDepth",
                    "design.outfit.placketEnd",
                )
                and value is None
            ):
                target.pop(key, None)
            else:
                target[key] = (
                    value.lower() if isinstance(value, str) else copy.deepcopy(value)
                )
        elif field == "shirtMark":
            if recipe["family"] == "sunshine" and not recipe.get("plainJersey"):
                raise ValueError("A custom print needs a plain jersey")
            if value is None:
                recipe.pop(field, None)
            else:
                if "sample" in value:
                    motif = (
                        garment_motif(source_patch, value["sample"])
                        if source_patch is not None
                        else None
                    )
                    value = traced_print(source_patch, motif, print_window)
                    if not value:
                        raise ValueError(
                            "Sample a point inside one solid shirt graphic"
                        )
                for path in [value["outline"], *value.get("islands", [])]:
                    validate_outline(path)
                recipe[field] = {**value, "color": value["color"].lower()}
        elif field == "visor":
            if value is None:
                recipe.pop("visor", None)
            elif visor_from_source:
                recipe["visor"] = copy.deepcopy(visor_from_source)
            else:
                raise ValueError(
                    "The source needs a measurable dark visor and two visible marks"
                )
        elif field == "orbOffset":
            recipe[field] = list(value)
        elif field == "sunRays":
            for rim in value:
                sides = []
                for k, (ax, ay) in enumerate(rim):
                    bx, by = rim[(k + 1) % len(rim)]
                    sides.extend(
                        (bx - ax) * (y - ay) - (by - ay) * (x - ax)
                        for j, (x, y) in enumerate(rim)
                        if j not in (k, (k + 1) % len(rim))
                    )
                if (
                    not (min(sides) >= 0.00001 or max(sides) <= -0.00001)
                    or max(map(abs, sides)) < 0.001
                    or any(not 0.92 <= math.hypot(x, y) <= 2.8 for x, y in rim)
                ):
                    raise ValueError(
                        "Sun rays require a convex outline outside the mascot orb"
                    )
            recipe[field] = copy.deepcopy(value)
        elif field == "lapels":
            for path in value["paths"]:
                if any(not 0 <= y <= 0.65 for x, y in path) or any(
                    b[1] <= a[1] for a, b in itertools.pairwise(path)
                ):
                    raise ValueError(
                        "Lapel points must descend from the collar along the coat"
                    )
            recipe[field] = copy.deepcopy(value)
        elif field == "eyeInk":
            if value is None:
                recipe.pop(field, None)
            else:
                recipe[field] = value.lower()
        elif field in (
            "eyeShape",
            "coatFit",
            "sleeveCut",
            "coatPanels",
            "limbWidth",
            "kitFit",
            "orbCollar",
        ):
            recipe[field] = copy.deepcopy(value)
        elif field == "shortsCut":
            recipe[field] = {**recipe.get(field, {}), **copy.deepcopy(value)}
        elif field == "orbPaint":
            # A pigment correction keeps the light measured on the sphere.
            recipe[field] = {**recipe.get(field, {}), **copy.deepcopy(value)}
        elif field == "penOutline":
            if value:
                recipe[field] = True
            else:
                recipe.pop(field, None)
        elif field == "crownOutline":
            if value is None:
                recipe.pop(field, None)
                continue
            angles = [math.atan2(y, x) for x, y in value]
            steps = [
                (b - a) % math.tau for a, b in zip(angles, angles[1:] + angles[:1])
            ]
            if (
                min(math.hypot(x, y) for x, y in value) < 0.15
                or min(steps) < 0.0001
                or max(steps) > math.pi / 2
                or abs(sum(steps) - math.tau) > 0.0001
            ):
                raise ValueError(
                    "Hair outline must span one clockwise turn around the scalp"
                )
            recipe[field] = copy.deepcopy(value)
        else:
            section, key = field.split(".")
            if section == "paints":
                value = value.lower()
            recipe[section][key] = value
    if recipe.get("construction") == "household":
        outfit = recipe["design"]["outfit"]
        buttons = outfit.get("buttons", [])
        if outfit["top"] != "polo":
            if any(
                outfit.get(k) is not None and "design.outfit." + k in seen
                for k in ("buttons", "placketDepth", "placketEnd", "buttonColor")
            ):
                raise ValueError(
                    "Shirt fasteners and opening depth require a collared shirt"
                )
            outfit.pop("buttons", None)
            outfit.pop("buttonColor", None)
            outfit.pop("placketDepth", None)
            outfit.pop("placketEnd", None)
        elif any(b - a < 0.035 for a, b in itertools.pairwise(buttons)):
            raise ValueError("Shirt buttons must run from the collar to the hem")
        elif not buttons:
            if outfit.get("buttonColor") and "design.outfit.buttonColor" in seen:
                raise ValueError("Fastener paint requires shirt buttons")
            if outfit.get("placketEnd") and "design.outfit.placketEnd" in seen:
                raise ValueError("A measured placket needs buttons")
            outfit.pop("buttonColor", None)
            outfit.pop("placketEnd", None)
        elif outfit.get("placketEnd", 1) < buttons[-1]:
            raise ValueError("The placket ends before the last button")
    return recipe
