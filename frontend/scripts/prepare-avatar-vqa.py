"""Prepare the pinned, CPU-capable BLIP VQA observer for offline avatar authoring."""

import argparse
import hashlib
import shutil
import tempfile
import urllib.request
import zipfile
from pathlib import Path

WEIGHTS = "https://storage.googleapis.com/sfr-vision-language-research/BLIP/models/model_base_vqa_capfilt_large.pth"
WEIGHTS_SHA = "7a7d546209f1ccfa8b3cd3a0138c53e0d1e95e4a4bc280bef8f67e20fe4925ae"
VOCAB_CONTAINER = "https://storage.googleapis.com/mediapipe-models/text_classifier/bert_classifier/float32/1/bert_classifier.tflite"
VOCAB_SHA = "07eced375cec144d27c900241f3e339478dec958f92fddbc551f295c992038a3"


def verify(path, expected):
    with path.open("rb") as stream:
        if hashlib.file_digest(stream, "sha256").hexdigest() != expected:
            raise ValueError(f"Unexpected SHA-256 for {path.name}")


def download(url, path):
    with urllib.request.urlopen(url, timeout=120) as response, path.open("wb") as out:
        shutil.copyfileobj(response, out)


def parameter_name(key):
    if not key.startswith("visual_encoder."):
        return key
    for source, dest in (
        ("visual_encoder.", "vision_model."),
        (".cls_token", ".embeddings.class_embedding"),
        (".pos_embed", ".embeddings.position_embedding"),
        (".patch_embed.proj.", ".embeddings.patch_embedding."),
        (".blocks.", ".encoder.layers."),
        (".attn.qkv.", ".self_attn.qkv."),
        (".attn.proj.", ".self_attn.projection."),
        (".norm1.", ".layer_norm1."),
        (".norm2.", ".layer_norm2."),
        ("vision_model.norm.", "vision_model.post_layernorm."),
    ):
        key = key.replace(source, dest)
    return key


def prepare(destination, weights, vocab):
    import torch
    from transformers import (
        BertTokenizerFast,
        BlipConfig,
        BlipForQuestionAnswering,
        BlipImageProcessor,
    )

    destination = destination.resolve()
    if destination.exists():
        raise ValueError("Choose a new directory for the converted checkpoint")
    destination.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(dir=destination.parent) as tmp:
        work = Path(tmp)
        if weights is None:
            weights = work / "vqa.pth"
            download(WEIGHTS, weights)
        verify(weights, WEIGHTS_SHA)
        if vocab is None:
            # The official MobileBERT task packages the same uncased BERT
            # WordPiece vocabulary. Verify its bytes before adding BLIP tokens.
            bundle = work / "tokenizer.tflite"
            download(VOCAB_CONTAINER, bundle)
            vocab = work / "vocab.txt"
            with zipfile.ZipFile(bundle) as package:
                vocab.write_bytes(package.read("vocab.txt"))
        verify(vocab, VOCAB_SHA)
        config = BlipConfig()
        config.vision_config.image_size = 480
        config.vision_config.layer_norm_eps = 1e-6
        model = BlipForQuestionAnswering(config)
        original = torch.load(
            weights, map_location="cpu", weights_only=True, mmap=True
        )["model"]
        state = {
            parameter_name(k): tensor
            for k, tensor in original.items()
            if not k.endswith("embeddings.position_ids")
        }
        model.load_state_dict(state, strict=True, assign=True)
        # Save both names for the decoder's tied input and output embedding.
        head = model.text_decoder.cls.predictions.decoder
        head.weight = torch.nn.Parameter(head.weight.detach().clone())
        export = work / "observer"
        model.save_pretrained(export, safe_serialization=True)
        tokenizer = BertTokenizerFast(vocab_file=str(vocab), do_lower_case=True)
        tokenizer.add_special_tokens(
            {"bos_token": "[DEC]", "additional_special_tokens": ["[ENC]"]}
        )
        tokenizer.save_pretrained(export)
        BlipImageProcessor(size={"width": 480, "height": 480}).save_pretrained(export)
        export.rename(destination)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("destination", type=Path)
    parser.add_argument(
        "--weights",
        type=Path,
        help="Already downloaded original Salesforce VQA weights",
    )
    parser.add_argument(
        "--vocab", type=Path, help="Already downloaded BERT base uncased vocabulary"
    )
    args = parser.parse_args()
    prepare(args.destination, args.weights, args.vocab)
