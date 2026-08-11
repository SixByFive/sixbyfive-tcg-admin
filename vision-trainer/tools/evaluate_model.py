# FILE: tools/evaluate_model.py
#
# Model health evaluation:
# - top-1/top-3/top-5 accuracy on val
# - confusion matrix plot (optional / auto-skipped for huge label counts)
# - per-class precision/recall/f1 (sklearn classification_report)
#
# UPDATED (2026-03-04)
#
# CHANGES:
# - FIX: Identity val/ may contain only a subset of classes, causing Keras to
#        re-index classes locally (0..N-1) based only on val folders.
#        This breaks evaluation because the model outputs logits for ALL train labels.
# - FIX: Remap val labels (local indices) -> global indices from labels.json.
# - FIX: classification_report now always receives an explicit `labels=range(len(labels))`
#        so target_names length ALWAYS matches.
# - ADD: metrics.json now includes debug info about val class names and skipped samples.
#
# EXTRA HARDENING (best-effort):
# - ADD: Always writes a metrics.json on failure (for UI/debugging consistency).
# - ADD: Auto-skip confusion matrix PNG when label count is large (performance/readability).
# - ADD: Safer top-k computation and early exits when val has no usable samples.

import json
from pathlib import Path

import numpy as np
import tensorflow as tf
from tensorflow import keras

# Keras 3 (TF 2.16+) moved image_dataset_from_directory from preprocessing → utils.
try:
    _image_dataset_from_directory = keras.utils.image_dataset_from_directory
except AttributeError:
    _image_dataset_from_directory = keras.preprocessing.image_dataset_from_directory

from sklearn.metrics import classification_report, confusion_matrix
import matplotlib.pyplot as plt


def _write_json(p: Path, obj):
    p.parent.mkdir(parents=True, exist_ok=True)
    with p.open("w", encoding="utf-8") as f:
        json.dump(obj, f, indent=2)


def evaluate_classifier(
    model_path: Path,
    labels_path: Path,
    dataset_root: Path,
    image_size: int,
    batch_size: int,
    out_dir: Path,
):
    model_path = Path(model_path)
    labels_path = Path(labels_path)
    dataset_root = Path(dataset_root)
    out_dir = Path(out_dir)

    out_dir.mkdir(parents=True, exist_ok=True)

    # ----------------------------
    # Helper: consistent "fail but still write metrics.json"
    # ----------------------------
    def fail_with_metrics(msg: str, extra: dict | None = None):
        payload = {"ok": False, "error": msg}
        if extra:
            payload.update(extra)
        _write_json(out_dir / "metrics.json", payload)
        return {"ok": False, "error": msg}

    if not model_path.exists():
        return fail_with_metrics(f"Missing model: {model_path}")

    if not labels_path.exists():
        return fail_with_metrics(f"Missing labels: {labels_path}")

    with labels_path.open("r", encoding="utf-8") as f:
        labels = json.load(f)

    if not isinstance(labels, list) or not labels:
        return fail_with_metrics(f"labels.json invalid or empty: {labels_path}")

    label_to_global = {name: i for i, name in enumerate(labels)}

    val_dir = dataset_root / "val"
    if not val_dir.exists():
        return fail_with_metrics(f"Missing val dir: {val_dir}")

    # IMPORTANT:
    # Keras will infer class_names from the folders present in val/.
    # If val/ only contains a subset of classes, those classes get re-indexed locally.
    # We'll remap local -> global using labels.json.
    try:
        val_ds = _image_dataset_from_directory(
            str(val_dir),
            image_size=(image_size, image_size),
            batch_size=batch_size,
            shuffle=False,
        )
    except Exception as e:
        return fail_with_metrics(f"Failed to load val dataset: {val_dir} ({e})")

    val_class_names = list(val_ds.class_names or [])
    local_to_global = {}
    unknown_local_classes = []

    for local_idx, class_name in enumerate(val_class_names):
        if class_name in label_to_global:
            local_to_global[local_idx] = label_to_global[class_name]
        else:
            unknown_local_classes.append(class_name)

    # Load model
    try:
        model = keras.models.load_model(model_path)
    except Exception as e:
        return fail_with_metrics(f"Failed to load model: {model_path} ({e})")

    num_labels_total = len(labels)
    all_label_ids = list(range(num_labels_total))

    # Collect predictions + true labels (in GLOBAL label space)
    y_true_global: list[int] = []
    y_pred_global: list[int] = []
    y_pred_top3: list[list[int]] = []
    y_pred_top5: list[list[int]] = []

    skipped_unknown_class_examples = 0
    total_val_examples_seen = 0

    # Iterate batches
    for batch_images, batch_labels_local in val_ds:
        batch_labels_local = batch_labels_local.numpy().astype(np.int32)
        total_val_examples_seen += int(batch_labels_local.shape[0])

        # Predict (probs shape: [B, num_labels_total])
        probs = model.predict(batch_images, verbose=0)

        if probs.ndim != 2 or probs.shape[1] != num_labels_total:
            # This should never happen in the normal pipeline; if it does, fail clearly.
            return fail_with_metrics(
                "Model output shape does not match labels.json.",
                extra={
                    "expected_num_labels": num_labels_total,
                    "model_output_shape": [int(x) for x in probs.shape],
                    "val_classes_found": len(val_class_names),
                    "val_class_names": val_class_names,
                },
            )

        # Top-k (safe even if num_labels_total < 5)
        k3 = min(3, num_labels_total)
        k5 = min(5, num_labels_total)

        top1 = np.argmax(probs, axis=1)
        top3 = np.argsort(-probs, axis=1)[:, :k3]
        top5 = np.argsort(-probs, axis=1)[:, :k5]

        # Remap each local label to global
        for i, local_lbl in enumerate(batch_labels_local):
            local_lbl_int = int(local_lbl)
            if local_lbl_int not in local_to_global:
                skipped_unknown_class_examples += 1
                continue

            true_global = int(local_to_global[local_lbl_int])

            y_true_global.append(true_global)
            y_pred_global.append(int(top1[i]))
            y_pred_top3.append([int(x) for x in top3[i].tolist()])
            y_pred_top5.append([int(x) for x in top5[i].tolist()])

    if not y_true_global:
        return fail_with_metrics(
            "No valid validation samples to evaluate (all samples were skipped or dataset empty).",
            extra={
                "num_labels_total": num_labels_total,
                "val_classes_found": len(val_class_names),
                "val_class_names": val_class_names,
                "unknown_val_classes": unknown_local_classes,
                "skipped_unknown_class_examples": int(skipped_unknown_class_examples),
                "val_examples_seen": int(total_val_examples_seen),
            },
        )

    y_true = np.array(y_true_global, dtype=np.int32)
    y_pred = np.array(y_pred_global, dtype=np.int32)

    # top-1
    top1_acc = float(np.mean(y_pred == y_true))

    # top-k (robust + vectorized-ish)
    # NOTE: y_pred_top3/top5 are python lists, but small enough; keep simple.
    top3_acc = float(np.mean([int(t) in y_pred_top3[i] for i, t in enumerate(y_true.tolist())]))
    top5_acc = float(np.mean([int(t) in y_pred_top5[i] for i, t in enumerate(y_true.tolist())]))

    # Confusion matrix (GLOBAL label space)
    cm = confusion_matrix(y_true, y_pred, labels=all_label_ids)

    # Decide whether to save a PNG confusion matrix.
    # Large label counts make this slow + unreadable.
    MAX_CM_LABELS_FOR_PNG = 200
    fig_path = out_dir / "confusion_matrix.png"
    cm_png_written = False

    if num_labels_total <= MAX_CM_LABELS_FOR_PNG:
        try:
            plt.figure(figsize=(10, 10))
            plt.imshow(cm, interpolation="nearest")
            plt.title("Confusion Matrix (val)")
            plt.xlabel("Predicted")
            plt.ylabel("True")
            plt.tight_layout()
            plt.savefig(fig_path)
            plt.close()
            cm_png_written = True
        except Exception:
            # Best effort: don't fail evaluation due to matplotlib issues
            cm_png_written = False

    # For large label counts where the PNG is skipped, write the top-20 most
    # confused class pairs instead — small JSON output, high diagnostic value.
    top_confused_pairs_path = None
    if num_labels_total > MAX_CM_LABELS_FOR_PNG:
        try:
            cm_no_diag = cm.copy()
            np.fill_diagonal(cm_no_diag, 0)
            flat = cm_no_diag.flatten()
            top_indices = np.argsort(-flat)[:20]
            confused_pairs = []
            for idx in top_indices:
                true_i, pred_i = divmod(int(idx), num_labels_total)
                count = int(cm_no_diag[true_i, pred_i])
                if count > 0:
                    confused_pairs.append({
                        "true": labels[true_i],
                        "pred": labels[pred_i],
                        "count": count,
                    })
            top_confused_pairs_path = out_dir / "top_confused_pairs.json"
            _write_json(top_confused_pairs_path, confused_pairs)
        except Exception:
            top_confused_pairs_path = None

    # Classification report (GLOBAL label space)
    # NOTE: specifying `labels=` ensures sklearn expects target_names of the same length.
    report = classification_report(
        y_true,
        y_pred,
        labels=all_label_ids,
        target_names=labels,
        output_dict=True,
        zero_division=0,
    )

    # Persist outputs
    _write_json(
        out_dir / "metrics.json",
        {
            "ok": True,
            "top1": top1_acc,
            "top3": top3_acc,
            "top5": top5_acc,
            "num_labels_total": num_labels_total,
            "val_classes_found": len(val_class_names),
            "val_class_names": val_class_names,
            "unknown_val_classes": unknown_local_classes,
            "skipped_unknown_class_examples": int(skipped_unknown_class_examples),
            "evaluated_examples": int(len(y_true)),
            "val_examples_seen": int(total_val_examples_seen),
            "confusion_matrix_png_written": bool(cm_png_written),
            "confusion_matrix_png_path": str(fig_path) if cm_png_written else None,
            "confusion_matrix_png_skipped_reason": (
                None
                if cm_png_written
                else (
                    f"skipped because num_labels_total={num_labels_total} > {MAX_CM_LABELS_FOR_PNG}"
                    if num_labels_total > MAX_CM_LABELS_FOR_PNG
                    else "skipped due to plotting error"
                )
            ),
            "top_confused_pairs_path": str(top_confused_pairs_path) if top_confused_pairs_path else None,
        },
    )
    _write_json(out_dir / "classification_report.json", report)

    return {
        "ok": True,
        "outDir": str(out_dir),
        "top1": top1_acc,
        "top3": top3_acc,
        "top5": top5_acc,
        "confusionMatrixPng": str(fig_path) if cm_png_written else None,
        "topConfusedPairs": str(top_confused_pairs_path) if top_confused_pairs_path else None,
        "evaluated_examples": int(len(y_true)),
        "skipped_unknown_class_examples": int(skipped_unknown_class_examples),
    }