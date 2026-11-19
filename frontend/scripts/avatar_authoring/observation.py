"""The provider-facing contract. All image coordinates refer to the supplied frame."""


def record(fields):
    return {
        "type": "object",
        "properties": fields,
        "required": list(fields),
        "additionalProperties": False,
    }


def choice(*values):
    return {"type": "string", "enum": list(values)}


def number(lo, hi):
    return {"type": "number", "minimum": lo, "maximum": hi}


def image_landmarks(observation):
    """Read bilateral pairs in image order even if an observer used anatomical left."""
    marks = dict(observation["landmarks"])
    for left, right in (
        ("leftEye", "rightEye"),
        ("leftCheek", "rightCheek"),
        ("mouthLeft", "mouthRight"),
    ):
        if marks[left]["x"] > marks[right]["x"]:
            marks[left], marks[right] = marks[right], marks[left]
    return marks


coord = number(0, 1000)
point = record({"x": coord, "y": coord})
observations_v1 = record(
    {
        "version": {"type": "integer", "enum": [1]},
        "name": {"type": "string", "minLength": 1, "maxLength": 60},
        "build": choice("child", "lean", "regular", "broad"),
        "skull": choice("round", "oval", "long", "square"),
        "eyes": choice("wide", "relaxed", "half-lidded"),
        "gaze": number(-0.7, 0.7),
        "brow": choice("worried", "level", "arched", "knit"),
        "nose": choice("button", "straight", "hooked"),
        "mouth": choice("uncertain", "smile", "neutral", "speaking", "lips"),
        "haircut": choice(
            "crop", "waves", "bob", "part", "ponytail", "bun", "curls", "quiff", "spikes"
        ),
        "footwear": choice("sneaker", "flat", "boot"),
        "top": choice("crew", "polo", "tank", "cardigan"),
        "lashes": {"type": "boolean"},
        "spectacles": {"type": "boolean"},
        "freckles": {"type": "boolean"},
        "samples": record(
            {
                role: point
                for role in ("skin", "hair", "shirt", "binding", "trousers", "shoes")
            }
        ),
        "bands": {
            "type": "array",
            "maxItems": 3,
            "items": record({"sample": point, "topY": coord, "bottomY": coord}),
        },
        "landmarks": record(
            {
                k: point
                for k in (
                    "crown",
                    "chin",
                    "leftCheek",
                    "rightCheek",
                    "leftEye",
                    "rightEye",
                    "noseTip",
                    "mouthLeft",
                    "mouthRight",
                    "shoulder",
                    "wrist",
                    "hem",
                    "ankle",
                )
            }
        ),
        "unsupported": {
            "type": "array",
            "maxItems": 12,
            "items": {"type": "string", "maxLength": 180},
        },
    }
)

# A previous drawing can always be replayed with its original measurements.
observations = record(
    {
        **observations_v1["properties"],
        "version": {"type": "integer", "enum": [2]},
        "top": choice("crew", "polo", "tank", "cardigan", "open-coat"),
        "details": record(
            {
                "frames": choice("round", "square"),
                "noseWidth": number(0.75, 1.5),
                "noseProjection": number(0.72, 1.55),
                "ponytailFall": number(0, 1),
            }
        ),
    }
)

# The full hosted tool keeps the strict v2 contract. A saved observation and
# the patch tool may also record individual benchmark-part choices.
part_fields = {
    "skull": choice("classic", "sunshine"),
    "jaw": choice("classic", "sunshine"),
    "legs": choice("classic", "sunshine"),
    "feet": choice("classic", "sunshine"),
    "hands": choice("classic", "sunshine"),
    "palmRoll": number(-90, 90),
    "handPitch": number(-30, 30),
}
fitted_observation = {
    **observations,
    "properties": {
        **observations["properties"],
        "details": {
            **observations["properties"]["details"],
            "properties": {
                **observations["properties"]["details"]["properties"],
                "eyeDepthScale": number(0.7, 1.4),
                "fringeDepthScale": number(0.75, 1.2),
            },
        },
        "parts": {
            "type": "object",
            "properties": part_fields,
            "additionalProperties": False,
        },
    },
}

measurement_instructions = """Read the front T-pose as a character artist. Locations use
0..1000 in each axis across the entire original image (left/top = 0). The first image is the
source. The second shows the same source with coordinate rulers and a magnified head. The
labels on the head crop already refer to the full frame. Estimate positions between ticks.
The optional side guide supplies depth. The remaining images show the body comparison, portrait
comparison, turnaround and any registered side comparison. Inspect both profiles. Compare the
face outline, pupil placement, hair part, collar and hands before deciding what to change. Image-left and right
always mean the viewer's left and right. Sample well inside a flat region; the compiler will
read its color. Place cheek markers on the lateral boundaries of the skull at its widest
point (infer skin covered by hair). Crown is the upper skull, excluding tall hair accessories.
When both dark pupils are measurable the guide suggests two eye centers. Verify them against the image.
Eye markers are eyeball centers; mouth markers are the two corners. Place shoulder at the
screen-right arm/torso joint, wrist at that hand's base, hem at the midpoint of the shirt's
lower edge, ankle at the screen-right trouser cuff. Put waist bands on the shirt only if visible,
with their actual upper/lower y. For binding use the neckline color (use the inner shirt on a
cardigan). Use open-coat for an open outer garment with long sleeves and two visible panels
past the waist. Sample the shirt inside its opening and place the hem on that shirt.
Select a cut, eye aperture, expression and body build from the vocabulary. Positive
gaze looks toward image-right. Nose width and projection have a neutral value of one.
Estimate width from the nose and extrapolate depth conservatively. Ponytail fall ranges from
zero for swept sideways to one for hanging down. Choose the frame shape if glasses are visible.
The compiler ignores frame and tail settings when those features are absent. List distinctive unsupported details and ambiguities. A single
view leaves back geometry and depth inferred."""

instructions = (
    measurement_instructions + "\nCall draw_cartoon with the complete observation."
)


def editable_fields():
    """Build the edit vocabulary from the public observation schema."""
    fields = {f"parts.{name}": value for name, value in part_fields.items()}
    for key, spec in fitted_observation["properties"].items():
        if key in ("version", "name", "parts"):
            continue
        if key in ("landmarks", "samples", "details"):
            fields.update(
                {f"{key}.{name}": value for name, value in spec["properties"].items()}
            )
        else:
            fields[key] = spec
    return fields


def edit_contract():
    # Identical coordinate types share one branch in the model's tool schema.
    import json

    groups = {}
    for field, spec in editable_fields().items():
        token = json.dumps(spec, sort_keys=True)
        groups.setdefault(token, (spec, []))[1].append(field)
    variants = [
        record({"field": choice(*names), "value": spec})
        for spec, names in groups.values()
    ]
    return record(
        {
            "name": observations["properties"]["name"],
            "base_pass": {"type": "integer", "minimum": 0},
            "edits": {
                "type": "array",
                "maxItems": len(editable_fields()),
                "items": {"anyOf": variants},
            },
        }
    )


draft_edits = edit_contract()
draft_instructions = """Review a saved observation against the original T-pose.
Select parts.skull for a fitted three-dimensional base. Classic transfers Rick's sculpted cranium and Sunshine supplies a smooth round dome. Set parts.jaw independently when the chin needs the other family's profile. Check how the eyes, hair and ears meet the head on turns.
Use parts.legs, parts.feet or parts.hands to select the classic or sunshine fit when the drawing calls for another profile. Palm roll and hand pitch are angles in degrees.
Choose a character name. Use the pass number of an earlier drawing, or base_pass 0 if automatic source measurements are available.
Return only changed fields in edits. An empty edits list accepts the measurements at the chosen pass.
Changing a landmark or a swatch takes an absolute point in the original 0–1000 image frame.
Inspect the haircut, expression, garment, accessories, hidden parts and posture. Record unsupported details when visible.
Use spikes for a crown with several distinct tips radiating around the head. Its front outline comes from the drawing and its depth from the shared measured crown.
For a swept bob, details.fringeDepthScale adjusts the forward reach of its short lock. One keeps the estimated depth. Reduce it if the lock projects beyond the forehead. Compare the front, 35 degree turn and both profiles.
details.eyeDepthScale changes how far the eye projects from its rear rim without moving the drawn landmarks. One keeps the initial fit. Increase it for a narrow profile white and decrease it for a bulging eye. Check both profiles and the far eye at 35 degrees after changing it.
Use eyes.turns in the render metrics to locate a missing pupil or a narrow far eye, then inspect that angle on the turnaround before revising."""
