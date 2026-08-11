# FILE: tools/train_classifier_explicit.py
#
# Generic explicit directory classifier trainer.
# Works for both:
#  - identity (set-number classes)
#  - finish (finish classes)
#
# Writes:
#  - model.keras
#  - savedmodel/ (SavedModel directory, for TFJS conversion via Node)
#  - labels.json
#  - train_history.json
#  - model_config.json
#
# UPDATED (2026-08-11)
#
# CHANGES:
# - CHANGE: Backbone switched from MobileNetV3Small to MobileNetV3Large for
#           better fine-grained feature extraction across hundreds of card classes.
# - CHANGE: Fine-tune layer freeze threshold 80% → 50% — unfreezes more mid-level
#           features that carry holo/texture detail critical for card identity.
# - ADD: Class weights — corrects bias toward over-represented card sets.
# - ADD: ReduceLROnPlateau — automatically reduces LR when val_top3 plateaus.
# - ADD: RandomHue + RandomSaturation augmentation for lighting/camera variation.
# - FIX: Augmentation layers now use distinct seeds to avoid correlated operations.
# - FIX: Validation can contain classes not present in train (identity early on).
# - FIX: Passing class_names=... to image_dataset_from_directory for val is STRICT in this Keras build.
# - CHANGE: Build val dataset manually from file paths for the INTERSECTION of train ∩ val folders.
# - ADD: If val has 0 usable images, train proceeds WITHOUT validation.
# - ADD: Training augmentation pipeline (random crop, flip, brightness, contrast, rotation).
#        Applied to train only — val is never augmented.

import json
from collections import Counter
from pathlib import Path
from typing import Any, Dict, List, Tuple

import tensorflow as tf
from tensorflow import keras
from tensorflow.keras import layers
from tensorflow.keras.applications import MobileNetV3Large
from tensorflow.keras.applications.mobilenet_v3 import preprocess_input


IMG_EXTS = {".jpg", ".jpeg", ".png", ".webp"}

# Keras 3 (TF 2.16+) moved image_dataset_from_directory from preprocessing → utils.
# This shim keeps the code compatible with both TF 2.15 (local/PyInstaller) and
# TF 2.16+ / Keras 3 (Heimdall).
try:
    _image_dataset_from_directory = keras.utils.image_dataset_from_directory
except AttributeError:
    _image_dataset_from_directory = keras.preprocessing.image_dataset_from_directory


def _write_json(p: Path, obj: Any):
    p.parent.mkdir(parents=True, exist_ok=True)
    with p.open("w", encoding="utf-8") as f:
        json.dump(obj, f, indent=2)


def _set_global_seed(seed: int):
    tf.keras.utils.set_random_seed(seed)
    try:
        tf.config.experimental.enable_op_determinism()
    except Exception:
        pass


def _safe_sparse_ce(label_smoothing: float):
    try:
        return keras.losses.SparseCategoricalCrossentropy(label_smoothing=label_smoothing), None
    except TypeError:
        if label_smoothing and label_smoothing > 0:
            return keras.losses.SparseCategoricalCrossentropy(), (
                f"SparseCategoricalCrossentropy(label_smoothing={label_smoothing}) "
                f"is not supported by this TensorFlow/Keras version. Continuing WITHOUT label smoothing."
            )
        return keras.losses.SparseCategoricalCrossentropy(), None


def _list_class_names(root: Path) -> List[str]:
    if not root.exists():
        return []
    return sorted([p.name for p in root.iterdir() if p.is_dir()])


def _gather_labeled_files(root: Path, class_names: List[str]) -> Tuple[List[str], List[int], List[str], List[str]]:
    paths: List[str] = []
    labels: List[int] = []
    used_classes: List[str] = []
    skipped_classes: List[str] = []

    for idx, cls in enumerate(class_names):
        cls_dir = root / cls
        if not cls_dir.exists() or not cls_dir.is_dir():
            skipped_classes.append(cls)
            continue

        cls_paths = []
        for p in cls_dir.rglob("*"):
            if p.is_file() and p.suffix.lower() in IMG_EXTS:
                cls_paths.append(str(p))

        if not cls_paths:
            skipped_classes.append(cls)
            continue

        used_classes.append(cls)
        paths.extend(cls_paths)
        labels.extend([idx] * len(cls_paths))

    return paths, labels, used_classes, skipped_classes


def _compute_class_weights(train_dir: Path, class_names: List[str]) -> Dict[int, float]:
    """
    Inverse-frequency class weights — corrects bias toward over-represented sets.
    Classes with more training images get a lower weight, rare classes get higher.
    """
    counts: Dict[int, int] = {}
    for idx, cls in enumerate(class_names):
        cls_dir = train_dir / cls
        if cls_dir.exists():
            count = sum(
                1 for p in cls_dir.rglob("*")
                if p.is_file() and p.suffix.lower() in IMG_EXTS
            )
        else:
            count = 0
        counts[idx] = max(count, 1)  # avoid division by zero for missing classes

    total = sum(counts.values())
    n = len(class_names)
    return {idx: total / (n * cnt) for idx, cnt in counts.items()}


def _decode_and_resize(path: tf.Tensor, label: tf.Tensor, image_size: int):
    bytes_ = tf.io.read_file(path)
    img = tf.io.decode_image(bytes_, channels=3, expand_animations=False)
    img = tf.image.resize(img, [image_size, image_size], method=tf.image.ResizeMethod.BILINEAR)
    img = tf.cast(img, tf.float32)
    return img, label


def _make_val_ds_from_paths(paths: List[str], labels: List[int], image_size: int, batch_size: int):
    ds = tf.data.Dataset.from_tensor_slices((paths, labels))
    ds = ds.map(lambda p, y: _decode_and_resize(p, y, image_size), num_parallel_calls=tf.data.AUTOTUNE)
    ds = ds.batch(batch_size)
    ds = ds.prefetch(tf.data.AUTOTUNE)
    return ds


def _build_augmentation_layer(image_size: int, seed: int) -> keras.Sequential:
    """
    Training-only augmentation pipeline for Pokemon card images.

    Choices based on observed real-world variation in training photos:
      - RandomCrop 90%: simulates slight framing differences
      - RandomFlip horizontal: cards are horizontally symmetric
      - RandomRotation +-15 degrees: matches natural hand-placement variation
      - RandomBrightness +-30%: covers lighting difference between backgrounds
      - RandomContrast +-20%: handles holo glare and flat lighting variation
      - RandomHue +-8%: compensates for color temperature differences between cameras
      - RandomSaturation 0.8–1.2x: handles holo shimmer and flat/oversaturated lighting

    Each layer gets a distinct seed offset to prevent correlated augmentation
    operations (e.g. brightness and contrast shifting in the same direction).

    Deliberately excluded:
      - Blur: blurry cards lose the fine detail (collector number, text layout)
              that distinguishes cards from each other. Real blur is noise, not signal.
      - Vertical flip: cards are always portrait orientation in production.
      - Heavy zoom out: cards always fill the frame, excessive padding is unrealistic.
    """
    aug_layers = [
        # Crop to 90% then resize back — simulates framing variation
        layers.RandomCrop(
            height=int(image_size * 0.9),
            width=int(image_size * 0.9),
            seed=seed,
        ),
        layers.Resizing(image_size, image_size),

        # Horizontal flip — cards are left-right symmetric
        layers.RandomFlip("horizontal", seed=seed + 1),

        # Rotation +-15 degrees (0.042 * 360 = ~15 degrees)
        layers.RandomRotation(factor=0.042, seed=seed + 2),

        # Brightness +-30% — covers the lighting difference between your two backgrounds
        layers.RandomBrightness(factor=0.3, seed=seed + 3),

        # Contrast +-20% — handles holo glare and flat lighting variation
        layers.RandomContrast(factor=0.2, seed=seed + 4),
    ]

    # RandomHue / RandomSaturation available in TF 2.15+; degrade gracefully if not
    try:
        aug_layers.append(layers.RandomHue(factor=0.08, seed=seed + 5))
    except AttributeError:
        pass

    try:
        aug_layers.append(layers.RandomSaturation(lower=0.8, upper=1.2, seed=seed + 6))
    except AttributeError:
        pass

    return keras.Sequential(aug_layers, name="augmentation")


def train_explicit_classifier(
    dataset_root: Path,
    out_dir: Path,
    image_size: int,
    batch_size: int,
    seed: int,
    epochs: int,
    learning_rate: float,
    fine_tune_at_epoch: int,
    fine_tune_lr: float,
    label_smoothing: float,
    dropout: float,
    run_name: str,
):
    dataset_root = Path(dataset_root)
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    _set_global_seed(seed)

    train_dir = dataset_root / "train"
    val_dir = dataset_root / "val"

    if not train_dir.exists() or not val_dir.exists():
        return {"ok": False, "error": f"Missing train/val dirs under {dataset_root}"}

    class_names = _list_class_names(train_dir)
    if not class_names:
        return {"ok": False, "error": f"No class folders found under: {train_dir}"}

    _write_json(out_dir / "labels.json", class_names)
    num_classes = len(class_names)

    warnings: List[str] = []

    # ----------------------------
    # Class weights (imbalance correction)
    # ----------------------------
    class_weight = _compute_class_weights(train_dir, class_names)

    # ----------------------------
    # TRAIN dataset
    # ----------------------------
    train_ds = _image_dataset_from_directory(
        str(train_dir),
        image_size=(image_size, image_size),
        batch_size=batch_size,
        shuffle=True,
        seed=seed,
    )

    # ----------------------------
    # VAL dataset (manual best-effort loader)
    # ----------------------------
    val_paths, val_labels, val_used_classes, val_skipped_train_classes = _gather_labeled_files(val_dir, class_names)

    if len(val_paths) == 0:
        warnings.append(
            "[warn] No usable validation images found after filtering to train classes. "
            "Training will run WITHOUT validation; metrics/checkpointing will be training-based."
        )
        val_ds = None
    else:
        val_folders = set(_list_class_names(val_dir))
        train_folders = set(class_names)
        val_only = sorted(list(val_folders - train_folders))
        if val_only:
            warnings.append(
                f"[warn] val/ contains {len(val_only)} class folder(s) not in train/; ignored (e.g. "
                f"{', '.join(val_only[:6])}{'...' if len(val_only) > 6 else ''})"
            )

        missing_val = sorted(list(train_folders - val_folders))
        if missing_val:
            warnings.append(
                f"[warn] val/ is missing {len(missing_val)} train class folder(s); "
                "val metrics will be weak early on."
            )

        val_ds = _make_val_ds_from_paths(val_paths, val_labels, image_size, batch_size)

    # ----------------------------
    # Augmentation — train only, never val
    # ----------------------------
    augment = _build_augmentation_layer(image_size, seed)

    def apply_augmentation(images, labels):
        return augment(images, training=True), labels

    train_ds = train_ds.map(apply_augmentation, num_parallel_calls=tf.data.AUTOTUNE)
    train_ds = train_ds.prefetch(tf.data.AUTOTUNE)

    # ----------------------------
    # Model — MobileNetV3Large backbone
    # Larger than Small (~5.4M vs ~2.9M params) for better fine-grained
    # feature extraction across hundreds of card set classes.
    # ----------------------------
    base = MobileNetV3Large(
        input_shape=(image_size, image_size, 3),
        include_top=False,
        weights="imagenet",
    )
    base.trainable = False

    inputs = keras.Input(shape=(image_size, image_size, 3))
    x = preprocess_input(inputs)
    x = base(x, training=False)
    x = layers.GlobalAveragePooling2D()(x)
    x = layers.Dropout(dropout)(x)
    outputs = layers.Dense(num_classes, activation="softmax")(x)

    model = keras.Model(inputs, outputs, name=f"classifier_{run_name}")

    loss, ls_warning = _safe_sparse_ce(label_smoothing)
    if ls_warning:
        print(f"[warn] {ls_warning}")

    model.compile(
        optimizer=keras.optimizers.Adam(learning_rate=learning_rate),
        loss=loss,
        metrics=[
            "accuracy",
            keras.metrics.SparseTopKCategoricalAccuracy(k=3, name="top3"),
            keras.metrics.SparseTopKCategoricalAccuracy(k=5, name="top5"),
        ],
    )

    # ----------------------------
    # Callbacks
    # ----------------------------
    ckpt_path = out_dir / "best.keras"

    if val_ds is None:
        monitor_metric = "top3"
        mode = "max"
    else:
        monitor_metric = "val_top3"
        mode = "max"

    callbacks = [
        keras.callbacks.ModelCheckpoint(
            filepath=str(ckpt_path),
            monitor=monitor_metric,
            mode=mode,
            save_best_only=True,
            save_weights_only=False,
        ),
        keras.callbacks.TensorBoard(
            log_dir=str(out_dir / "tensorboard"),
            histogram_freq=1,
        ),
        # Reduce LR by 60% when the monitored metric stops improving for 3 epochs.
        # Complements EarlyStopping — gives the optimizer a chance to escape plateaus
        # before training terminates.
        keras.callbacks.ReduceLROnPlateau(
            monitor=monitor_metric,
            mode=mode,
            factor=0.4,
            patience=3,
            min_lr=1e-7,
            verbose=1,
        ),
    ]

    if val_ds is not None:
        callbacks.append(
            keras.callbacks.EarlyStopping(
                monitor="val_top3",
                mode="max",
                patience=6,
                restore_best_weights=True,
            )
        )

    history_all = {"stage1": None, "stage2": None}
    meta = {
        "warnings": warnings,
        "val_images": int(len(val_paths)),
        "val_used_classes": val_used_classes,
    }

    for w in warnings:
        print(w)

    # ----------------------------
    # Stage 1 - head training
    # ----------------------------
    stage1_epochs = max(1, min(int(epochs), int(fine_tune_at_epoch)))

    h1 = model.fit(
        train_ds,
        validation_data=val_ds,
        epochs=stage1_epochs,
        callbacks=callbacks,
        class_weight=class_weight,
        verbose=1,
    )
    history_all["stage1"] = h1.history

    # ----------------------------
    # Stage 2 - fine tune (optional)
    # Unfreezes the top 50% of backbone layers (vs 20% previously).
    # Mid-level features carry holo/texture detail critical for card identity.
    # ----------------------------
    if int(epochs) > stage1_epochs:
        base.trainable = True

        freeze_until = int(len(base.layers) * 0.5)
        for i, layer in enumerate(base.layers):
            layer.trainable = i >= freeze_until

        model.compile(
            optimizer=keras.optimizers.Adam(learning_rate=float(fine_tune_lr)),
            loss=loss,
            metrics=[
                "accuracy",
                keras.metrics.SparseTopKCategoricalAccuracy(k=3, name="top3"),
                keras.metrics.SparseTopKCategoricalAccuracy(k=5, name="top5"),
            ],
        )

        h2 = model.fit(
            train_ds,
            validation_data=val_ds,
            epochs=int(epochs),
            initial_epoch=stage1_epochs,
            callbacks=callbacks,
            class_weight=class_weight,
            verbose=1,
        )
        history_all["stage2"] = h2.history

    # ----------------------------
    # Save outputs
    # ----------------------------
    model.save(out_dir / "model.keras")

    savedmodel_dir = out_dir / "savedmodel"
    tf.saved_model.save(model, str(savedmodel_dir))

    _write_json(out_dir / "train_history.json", {"history": history_all, "meta": meta})
    _write_json(
        out_dir / "model_config.json",
        {
            "run_name": run_name,
            "image_size": image_size,
            "batch_size": batch_size,
            "seed": seed,
            "epochs": int(epochs),
            "learning_rate": float(learning_rate),
            "fine_tune_at_epoch": int(fine_tune_at_epoch),
            "fine_tune_lr": float(fine_tune_lr),
            "label_smoothing": float(label_smoothing),
            "dropout": float(dropout),
            "num_classes": int(num_classes),
            "labels_preview": class_names[:10],
            "backbone": "MobileNetV3Large",
            "preprocess": "tensorflow.keras.applications.mobilenet_v3.preprocess_input",
            "fine_tune_freeze_pct": 0.5,
            "val_images_used": int(len(val_paths)),
            "val_used_classes_preview": val_used_classes[:10],
            "warnings": warnings,
            "augmentation": {
                "random_crop": "90% of image_size",
                "random_flip": "horizontal",
                "random_rotation": "+-15 degrees",
                "random_brightness": "+-30%",
                "random_contrast": "+-20%",
                "random_hue": "+-8% (if supported)",
                "random_saturation": "0.8x–1.2x (if supported)",
            },
        },
    )

    last_hist = history_all["stage2"] or history_all["stage1"] or {}

    def last(k, default=None):
        arr = last_hist.get(k)
        return float(arr[-1]) if isinstance(arr, list) and arr else default

    return {
        "ok": True,
        "outDir": str(out_dir),
        "numClasses": int(num_classes),
        "val_accuracy": last("val_accuracy"),
        "val_top3": last("val_top3"),
        "val_top5": last("val_top5"),
        "bestModel": str(ckpt_path) if ckpt_path.exists() else None,
        "savedModelDir": str(savedmodel_dir) if savedmodel_dir.exists() else None,
        "warnings": warnings,
        "valImagesUsed": int(len(val_paths)),
        "valUsedClasses": val_used_classes,
    }
