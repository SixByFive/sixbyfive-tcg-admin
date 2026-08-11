# FILE: tools/export_tflite.py
#
# Exports a Keras model to TFLite:
# - FP16 (fast, small, easy)
# - Optional INT8 (requires representative dataset)
#
# Output files are written into the model out_dir.

import json
from pathlib import Path
import numpy as np
import tensorflow as tf
from tensorflow import keras

IMG_EXTS = {".jpg", ".jpeg", ".png", ".webp"}


def _iter_images(dir_path: Path, limit: int = 200):
    # representative dataset for INT8
    n = 0
    for p in dir_path.rglob("*"):
        if p.is_file() and p.suffix.lower() in IMG_EXTS:
            yield p
            n += 1
            if n >= limit:
                break


def _load_image_as_float(p: Path, image_size: int):
    raw = tf.io.read_file(str(p))
    img = tf.image.decode_image(raw, channels=3, expand_animations=False)
    img = tf.image.resize(img, (image_size, image_size))
    img = tf.cast(img, tf.float32)
    return img


def export_tflite_bundle(
    model_path: Path,
    out_dir: Path,
    make_fp16: bool,
    make_int8: bool,
    representative_dir: Path,
    image_size: int,
):
    model_path = Path(model_path)
    out_dir = Path(out_dir)
    representative_dir = Path(representative_dir)

    if not model_path.exists():
        return {"ok": False, "error": f"Missing model: {model_path}"}

    model = keras.models.load_model(model_path)

    results = {"ok": True, "outDir": str(out_dir), "fp16": None, "int8": None, "warnings": []}

    # FP16
    if make_fp16:
        converter = tf.lite.TFLiteConverter.from_keras_model(model)
        converter.optimizations = [tf.lite.Optimize.DEFAULT]
        converter.target_spec.supported_types = [tf.float16]
        tflite = converter.convert()

        fp16_path = out_dir / "model_fp16.tflite"
        fp16_path.write_bytes(tflite)
        results["fp16"] = str(fp16_path)

    # INT8
    if make_int8:
        if not representative_dir.exists():
            results["warnings"].append(f"INT8 requested but representative_dir missing: {representative_dir}")
        else:
            def rep_gen():
                for p in _iter_images(representative_dir, limit=200):
                    img = _load_image_as_float(p, image_size)
                    img = tf.expand_dims(img, axis=0)  # [1, H, W, 3]
                    yield [img]

            converter = tf.lite.TFLiteConverter.from_keras_model(model)
            converter.optimizations = [tf.lite.Optimize.DEFAULT]
            converter.representative_dataset = rep_gen

            # Full integer quantization
            converter.target_spec.supported_ops = [tf.lite.OpsSet.TFLITE_BUILTINS_INT8]
            converter.inference_input_type = tf.int8
            converter.inference_output_type = tf.int8

            tflite = converter.convert()
            int8_path = out_dir / "model_int8.tflite"
            int8_path.write_bytes(tflite)
            results["int8"] = str(int8_path)

    return results