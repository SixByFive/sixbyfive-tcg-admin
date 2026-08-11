# FILE: tools/check_dataset.py
#
# Dataset health checks for explicit train/val layout:
#   dataset_root/
#     train/<class>/*.jpg
#     val/<class>/*.jpg
#
# UPDATED (2026-03-03) — MUCH LESS STRICT
#
# CHANGES:
# - CHANGED: Only FAIL when training is impossible:
#   - Missing train/ or val/
#   - No class folders in train/
#   - Total train images == 0 OR total val images == 0
# - CHANGED: Per-class issues (0 train/0 val, low images, etc.) are WARNINGS ONLY.
# - KEPT: Recommended warnings: low class count, low images per class, etc.
# - ADD: summary field for clean logs.

from pathlib import Path

IMG_EXTS = {".jpg", ".jpeg", ".png", ".webp"}


def _count_images_in_dir(d: Path) -> int:
    if not d.exists():
        return 0
    n = 0
    for p in d.rglob("*"):
        if p.is_file() and p.suffix.lower() in IMG_EXTS:
            n += 1
    return n


def check_explicit_dataset(
    dataset_root: Path,
    name: str,
    min_images_per_class_warn: int,
    min_classes_warn: int,
):
    dataset_root = Path(dataset_root)
    train_root = dataset_root / "train"
    val_root = dataset_root / "val"

    out = {
        "ok": True,
        "name": name,
        "datasetRoot": str(dataset_root),
        "trainRoot": str(train_root),
        "valRoot": str(val_root),
        "counts": {},
        "perClass": {},
        "warnings": [],
        "errors": [],
        "summary": "",
    }

    # ----------------------------
    # Hard fail only if structure is broken
    # ----------------------------
    if not train_root.exists():
        out["ok"] = False
        out["errors"].append(f"Missing: {train_root}")
        out["summary"] = "Missing train/ directory."
        return out

    if not val_root.exists():
        out["ok"] = False
        out["errors"].append(f"Missing: {val_root}")
        out["summary"] = "Missing val/ directory."
        return out

    classes = sorted([p.name for p in train_root.iterdir() if p.is_dir()])

    if not classes:
        out["ok"] = False
        out["errors"].append(f"No class folders found under: {train_root}")
        out["summary"] = "No class folders in train/."
        return out

    # Recommended warning only
    if len(classes) < min_classes_warn:
        out["warnings"].append(
            f"Low class count for {name}: {len(classes)} (recommended >= {min_classes_warn})"
        )

    # ----------------------------
    # Count images (never hard-fail per-class)
    # ----------------------------
    total_train = 0
    total_val = 0

    for cls in classes:
        train_cls = train_root / cls
        val_cls = val_root / cls

        n_train = _count_images_in_dir(train_cls)
        n_val = _count_images_in_dir(val_cls)

        total_train += n_train
        total_val += n_val

        out["perClass"][cls] = {"train": n_train, "val": n_val, "total": n_train + n_val}

        # Warnings only (not failures)
        if (n_train + n_val) < min_images_per_class_warn:
            out["warnings"].append(
                f"Class '{cls}' low images: {n_train + n_val} (recommended >= {min_images_per_class_warn})"
            )

        if n_train == 0:
            out["warnings"].append(f"Class '{cls}' has 0 train images (won't learn from train)")
        if n_val == 0:
            out["warnings"].append(f"Class '{cls}' has 0 val images (val metrics less reliable)")

    out["counts"] = {
        "classes": len(classes),
        "trainImages": total_train,
        "valImages": total_val,
        "totalImages": total_train + total_val,
    }

    # ----------------------------
    # The ONLY real "can't train" failure:
    # one of the splits is completely empty.
    # ----------------------------
    if total_train == 0 :
        out["ok"] = False
        out["errors"].append(
            f"Train/Val images missing entirely (train={total_train}, val={total_val})."
        )
        out["summary"] = "Train/Val split empty (cannot train)."
        return out
    
    if total_val == 0:
        out["warnings"].append(
            "No validation images found. Training will still run but metrics will be unreliable"
        )

    out["summary"] = "Dataset check passed."
    return out