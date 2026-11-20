"""Optional CPU visual question answering for the one-image author, outside the player."""

import hashlib
from functools import lru_cache
from pathlib import Path
from time import monotonic

from PIL import Image, ImageOps


@lru_cache(maxsize=1)
def load_observer(folder):
    try:
        import torch
        from transformers import (
            BertTokenizerFast,
            BlipForQuestionAnswering,
            BlipImageProcessor,
        )
        from transformers import __version__ as transformers_version
    except ImportError as error:
        raise ValueError(
            "The local BLIP observer needs torch and transformers"
        ) from error

    # Load only the operator's safetensors and tokenizer. Authoring workers may
    # have no network credentials, and the browser never downloads this model.
    weights = folder / "model.safetensors"
    with weights.open("rb") as stream:
        fingerprint = hashlib.file_digest(stream, "sha256").hexdigest()
    model = BlipForQuestionAnswering.from_pretrained(
        folder, local_files_only=True, use_safetensors=True
    ).eval()
    tokenizer = BertTokenizerFast.from_pretrained(folder, local_files_only=True)
    processor = BlipImageProcessor.from_pretrained(folder, local_files_only=True)
    encoder_token = tokenizer.convert_tokens_to_ids("[ENC]")
    if encoder_token == tokenizer.unk_token_id or tokenizer.bos_token_id is None:
        raise ValueError(
            "The BLIP tokenizer needs the matching encoder and decoder tokens"
        )
    return (
        model,
        tokenizer,
        processor,
        encoder_token,
        {
            "transport": "local",
            "reported_model": "BLIP VQA (" + model.config.model_type + ")",
            "weights_sha256": fingerprint,
            "torch": torch.__version__,
            "transformers": transformers_version,
        },
    )


def observe_source(folder, source, family, framing):
    started = monotonic()
    model, tokenizer, processor, encoder_token, identity = load_observer(
        Path(folder).resolve()
    )
    import torch

    questions = {
        "glasses": "Is this person wearing sunglasses?",
        "top": "What kind of shirt is the person wearing?",
    }
    if family == "rick-classic":
        questions["hair"] = "How is this person's hair styled?"
    if framing == "full":
        questions["feet"] = "What type of shoes is the person wearing?"
    with Image.open(source) as original:
        rgba = ImageOps.exif_transpose(original).convert("RGBA")
        image = Image.new("RGBA", rgba.size, "white")
        image.alpha_composite(rgba)
    # Encode the supplied pixels once. Each short question attends to the
    # same image embedding. Greedy decoding keeps repeated answers stable.
    with torch.inference_mode():
        pixels = processor(image.convert("RGB"), return_tensors="pt").pixel_values
        scene = model.vision_model(pixel_values=pixels).last_hidden_state
        tokens = tokenizer(list(questions.values()), padding=True, return_tensors="pt")
        tokens.input_ids[:, 0] = encoder_token
        scene = scene.expand(len(questions), -1, -1)
        memory = model.text_encoder(
            input_ids=tokens.input_ids,
            attention_mask=tokens.attention_mask,
            encoder_hidden_states=scene,
            encoder_attention_mask=torch.ones(scene.shape[:2], dtype=torch.long),
            return_dict=True,
        ).last_hidden_state
        output = model.text_decoder.generate(
            input_ids=torch.full((len(questions), 1), tokenizer.bos_token_id),
            encoder_hidden_states=memory,
            encoder_attention_mask=tokens.attention_mask,
            eos_token_id=tokenizer.sep_token_id,
            pad_token_id=tokenizer.pad_token_id,
            max_new_tokens=7,
            num_beams=1,
            do_sample=False,
        )
    answers = dict(
        zip(questions, tokenizer.batch_decode(output, skip_special_tokens=True))
    )
    return answers, {
        **identity,
        "operation": "observe_source",
        "source_sha256": hashlib.sha256(source.read_bytes()).hexdigest(),
        "seconds": round(monotonic() - started, 3),
        "questions": questions,
        "answers": answers,
        "usage": {"cost": 0},
    }


def wardrobe(answers):
    # Map literal clothing observations to existing parts. No queried or
    # inferred shoe is used when the input was a portrait.
    return {
        key: choices[answer]
        for key, choices in (
            (
                "top",
                {
                    "button up": "polo",
                    "button down": "polo",
                    "polo": "polo",
                    "t shirt": "crew",
                    "tank top": "tank",
                },
            ),
            (
                "feet",
                {
                    "sneakers": "sneaker",
                    "tennis shoes": "sneaker",
                    "flats": "flat",
                    "boots": "boot",
                },
            ),
            ("hair", {"ponytail": "ponytail", "short": "crop"}),
        )
        if (answer := answers.get(key, "").strip().lower()) in choices
    }


def full_edits(recipe, answers):
    if recipe.get("construction") != "household":
        return []
    outfit = recipe["design"]["outfit"]
    sections = recipe["design"]["household"]["body"]["sections"]
    choices = wardrobe(answers)
    edits = []
    if (
        "feet" in choices
        and sections.get("outsole")
        and choices["feet"] != outfit["footwear"]
    ):
        edits.append({"field": "design.outfit.footwear", "value": choices["feet"]})
    # A genuine placket or tank binding carries measured geometry. Preserve
    # it when the model gives a generic "t shirt" answer.
    if (
        choices.get("top") == "polo"
        and outfit["top"] == "crew"
        and outfit.get("buttons")
    ):
        edits.append({"field": "design.outfit.top", "value": "polo"})
    return edits
