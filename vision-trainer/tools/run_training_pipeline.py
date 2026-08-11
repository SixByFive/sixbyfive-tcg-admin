# FILE: vision-trainer/tools/run_training_pipeline.py
#
# UPDATED (2026-03-19)
#
# CHANGES:
#   - ADD: Step [0/6] — split_datasets.py runs before health checks every time.
#          Reads identity_raw/ and finish_raw/, rebuilds identity_explicit/ and
#          finish_explicit/ with a clean deterministic train/val split.
#          This ensures new images are always included without a manual split step.
#   - ADD: --val-ratio and --seed CLI args (defaults match Vision Lab)
#   - KEEP: All existing steps unchanged

import argparse
import json
import sys
import shutil
import subprocess
import platform
from pathlib import Path
from datetime import datetime

from check_dataset import check_explicit_dataset
from train_classifier_explicit import train_explicit_classifier
from evaluate_model import evaluate_classifier
from export_tflite import export_tflite_bundle
from export_tfjs import export_tfjs_graph_model
from split_datasets import split_training_datasets   # NEW


IMG_EXTS = {".jpg", ".jpeg", ".png", ".webp"}


def load_json(p: Path):
    with p.open("r", encoding="utf-8") as f:
        return json.load(f)


def write_json(p: Path, obj):
    p.parent.mkdir(parents=True, exist_ok=True)
    with p.open("w", encoding="utf-8") as f:
        json.dump(obj, f, indent=2)


def now_iso():
    return datetime.utcnow().isoformat(timespec="seconds") + "Z"


def fail(run_report_path: Path, run_report: dict, step_key: str, message: str, exit_code: int = 1):
    run_report["steps"][step_key] = {"ok": False, "error": message}
    write_json(run_report_path, run_report)
    print(message)
    sys.exit(exit_code)


def _first_image_file(d: Path) -> Path | None:
    if not d.exists():
        return None
    candidates = []
    for p in d.rglob("*"):
        if p.is_file() and p.suffix.lower() in IMG_EXTS:
            candidates.append(p)
    if not candidates:
        return None
    candidates.sort(key=lambda p: str(p).lower())
    return candidates[0]


def _resolve_unc_to_drive(p: Path) -> Path:
    if platform.system() != "Windows":
        return p

    p_str = str(p).replace("/", "\\")

    if not p_str.startswith("\\\\"):
        return p

    inner = p_str.lstrip("\\")
    segments = inner.split("\\")

    if len(segments) < 2:
        print(f"[warn] Cannot parse UNC root from path: {p_str}")
        return p

    unc_root = f"\\\\{segments[0]}\\{segments[1]}"
    remainder = "\\".join(segments[2:]) if len(segments) > 2 else ""

    try:
        result = subprocess.run(
            ["net", "use"],
            capture_output=True,
            text=True,
            timeout=10,
        )
        for line in result.stdout.splitlines():
            tokens = line.split()
            for i, tok in enumerate(tokens):
                if (
                    len(tok) == 2
                    and tok[1] == ":"
                    and tok[0].isalpha()
                    and i + 1 < len(tokens)
                    and tokens[i + 1].lower().startswith(unc_root.lower())
                ):
                    drive = tok.upper()
                    resolved = Path(drive + "\\" + remainder) if remainder else Path(drive + "\\")
                    print(f"[info] UNC share {unc_root} already mapped as {drive} — using {resolved}")
                    return resolved
    except Exception as e:
        print(f"[warn] Could not query 'net use' to check existing drive mappings: {e}")

    for letter in "ZYXWVUTSRQPONMLKJIHGFE":
        drive = f"{letter}:"
        if not Path(drive + "\\").exists():
            try:
                res = subprocess.run(
                    ["net", "use", drive, unc_root],
                    capture_output=True,
                    text=True,
                    timeout=15,
                )
                if res.returncode == 0:
                    resolved = Path(drive + "\\" + remainder) if remainder else Path(drive + "\\")
                    print(f"[info] Mapped UNC share {unc_root} -> {drive} for TensorFlow compatibility")
                    return resolved
                else:
                    print(f"[warn] 'net use {drive} {unc_root}' failed: {res.stderr.strip()}")
                    break
            except Exception as e:
                print(f"[warn] Failed to map {unc_root} to {drive}: {e}")
                break

    print(
        f"[warn] Could not map UNC path {unc_root} to a drive letter. "
        f"TensorFlow may fail when accessing network paths. "
        f"Try mapping the share manually (e.g. 'net use Z: {unc_root}') before running training."
    )
    return p


def _cache_datasets_locally(
    identity_ds: Path,
    finish_ds: Path,
    run_id: str,
    only: str | None,
) -> tuple[Path, Path, Path]:
    import tempfile

    cache_root = Path(tempfile.gettempdir()) / f"sbf-visionlab-{run_id}"
    cache_root.mkdir(parents=True, exist_ok=True)

    local_identity_ds = cache_root / "identity_explicit"
    local_finish_ds = cache_root / "finish_explicit"

    if only in (None, "identity"):
        print(f"[cache] Copying identity dataset to local temp: {local_identity_ds}")
        if local_identity_ds.exists():
            shutil.rmtree(local_identity_ds)
        shutil.copytree(str(identity_ds), str(local_identity_ds))
        print(f"[cache] Identity dataset cached.")

    if only in (None, "finish"):
        print(f"[cache] Copying finish dataset to local temp: {local_finish_ds}")
        if local_finish_ds.exists():
            shutil.rmtree(local_finish_ds)
        shutil.copytree(str(finish_ds), str(local_finish_ds))
        print(f"[cache] Finish dataset cached.")

    return local_identity_ds, local_finish_ds, cache_root


def _cleanup_local_cache(cache_root: Path):
    try:
        if cache_root.exists():
            shutil.rmtree(cache_root)
            print(f"[cache] Cleaned up local cache: {cache_root}")
    except Exception as e:
        print(f"[cache] Warning: could not clean up local cache {cache_root}: {e}")


def bootstrap_validation_set(dataset_root: Path, name: str, min_val_per_class: int = 1) -> dict:
    dataset_root = Path(dataset_root)
    train_root = dataset_root / "train"
    val_root = dataset_root / "val"

    out = {
        "ok": True,
        "name": name,
        "datasetRoot": str(dataset_root),
        "trainRoot": str(train_root),
        "valRoot": str(val_root),
        "minValPerClass": int(min_val_per_class),
        "classesSeen": 0,
        "classesBootstrapped": 0,
        "filesCopied": 0,
        "warnings": [],
        "details": {},
    }

    if not train_root.exists():
        out["ok"] = False
        out["warnings"].append(f"bootstrap skipped: missing train folder: {train_root}")
        return out

    val_root.mkdir(parents=True, exist_ok=True)

    class_dirs = sorted([p for p in train_root.iterdir() if p.is_dir()])
    out["classesSeen"] = len(class_dirs)

    for cls_dir in class_dirs:
        cls = cls_dir.name
        train_cls = train_root / cls
        val_cls = val_root / cls
        val_cls.mkdir(parents=True, exist_ok=True)

        val_imgs = [p for p in val_cls.rglob("*") if p.is_file() and p.suffix.lower() in IMG_EXTS]
        train_imgs = [p for p in train_cls.rglob("*") if p.is_file() and p.suffix.lower() in IMG_EXTS]

        val_before = len(val_imgs)
        train_count = len(train_imgs)

        out["details"][cls] = {"valBefore": val_before, "valAfter": val_before, "copied": []}

        if train_count == 0:
            out["warnings"].append(f"Class '{cls}' has 0 train images; cannot bootstrap val.")
            continue

        if val_before >= min_val_per_class:
            continue

        train_imgs_sorted = sorted(train_imgs, key=lambda p: str(p).lower())
        needed = min_val_per_class - val_before

        copied_any = False
        for i in range(needed):
            src = train_imgs_sorted[i % len(train_imgs_sorted)]
            dst = val_cls / src.name

            if dst.exists():
                stem = dst.stem
                suf = dst.suffix
                j = 2
                while True:
                    alt = val_cls / f"{stem}__dup{j}{suf}"
                    if not alt.exists():
                        dst = alt
                        break
                    j += 1

            shutil.copy2(src, dst)
            out["filesCopied"] += 1
            copied_any = True
            out["details"][cls]["copied"].append(str(dst))

        if copied_any:
            out["classesBootstrapped"] += 1

        val_imgs_after = [p for p in val_cls.rglob("*") if p.is_file() and p.suffix.lower() in IMG_EXTS]
        out["details"][cls]["valAfter"] = len(val_imgs_after)

        out["warnings"].append(
            f"[best-effort] Bootstrapped val for '{cls}' by duplicating from train "
            f"({val_before} -> {len(val_imgs_after)}). Metrics may be optimistic for this class."
        )

    if out["filesCopied"] == 0:
        out["warnings"].append("No bootstrap actions taken (val already had enough samples).")

    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument(
        "--workspace",
        required=True,
        help="Vision Lab Workspace path (contains datasets/)",
    )
    ap.add_argument(
        "--config",
        default=str(Path(__file__).resolve().parent.parent / "config" / "training.default.json"),
        help="Path to training config JSON (default: config/training.default.json)",
    )
    ap.add_argument("--only", choices=["identity", "finish"], default=None)
    ap.add_argument("--no-export", action="store_true")
    ap.add_argument(
        "--val-ratio",
        type=float,
        default=0.2,
        help="Fraction of classes assigned to val split (default: 0.2). Must match Vision Lab setting.",
    )
    ap.add_argument(
        "--seed",
        default="visionlab-v1",
        help="Deterministic split seed (default: visionlab-v1). Must match Vision Lab setting.",
    )
    ap.add_argument(
        "--min-per-class",
        type=int,
        default=2,
        help="Minimum images per identity class to include in training (default: 2).",
    )
    args = ap.parse_args()

    workspace = Path(args.workspace).expanduser().resolve()
    workspace = _resolve_unc_to_drive(workspace)
    cfg_path = Path(args.config).expanduser().resolve()

    reports_dir = workspace / "reports"
    models_dir = workspace / "models"
    tfjs_dir = workspace / "tfjs"

    reports_dir.mkdir(parents=True, exist_ok=True)
    models_dir.mkdir(parents=True, exist_ok=True)
    tfjs_dir.mkdir(parents=True, exist_ok=True)

    run_id = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    run_report_path = reports_dir / f"training_run_{run_id}.json"

    run_report = {
        "ok": False,
        "runId": run_id,
        "startedAt": now_iso(),
        "workspace": str(workspace),
        "configPath": str(cfg_path),
        "config": None,
        "steps": {},
    }

    if not cfg_path.exists():
        fail(run_report_path, run_report, "config", f"Config file not found: {cfg_path}")

    try:
        cfg = load_json(cfg_path)
    except Exception as e:
        fail(run_report_path, run_report, "config", f"Failed to parse config JSON: {cfg_path} ({e})")

    run_report["config"] = cfg

    # ── [0/6] Split datasets ──────────────────────────────────────────────────
    # Always rebuild explicit splits from raw so new images are always included.
    # Uses the same deterministic seed as Vision Lab so results are consistent.
    print("\n[0/6] Splitting datasets...\n")

    split_result = split_training_datasets(
        workspace=workspace,
        clean=False,              # preserve existing explicit splits — only add new images
        prefer="copy",            # hardlinks don't work across Samba/NFS shares
        val_ratio=args.val_ratio,
        seed=args.seed,
        min_per_identity_train=args.min_per_class,
    )
    run_report["steps"]["split"] = split_result

    if not split_result.get("ok"):
        fail(
            run_report_path,
            run_report,
            "split",
            f"Dataset split failed: {split_result.get('error')}",
        )

    id_counts = split_result["counts"]["identity"]
    fi_counts = split_result["counts"]["finish"]
    print(
        f"[split] identity — train: {id_counts['train']}  val: {id_counts['val']}  "
        f"| finish — train: {fi_counts['train']}  val: {fi_counts['val']}"
    )

    # ── [1/6] Dataset health checks ───────────────────────────────────────────
    print("\n[1/6] Checking datasets...\n")

    identity_ds = workspace / "datasets" / "identity_explicit"
    finish_ds = workspace / "datasets" / "finish_explicit"

    if args.only in (None, "identity") and not identity_ds.exists():
        fail(
            run_report_path,
            run_report,
            "dataset_identity",
            f"Missing identity dataset folder: {identity_ds}\n"
            f"Expected structure: identity_explicit/train/<class>/... and identity_explicit/val/<class>/...",
        )

    if args.only in (None, "finish") and not finish_ds.exists():
        fail(
            run_report_path,
            run_report,
            "dataset_finish",
            f"Missing finish dataset folder: {finish_ds}\n"
            f"Expected structure: finish_explicit/train/<class>/... and finish_explicit/val/<class>/...",
        )

    if args.only in (None, "identity"):
        run_report["steps"]["bootstrap_identity_val"] = bootstrap_validation_set(
            identity_ds,
            name="identity",
            min_val_per_class=1,
        )

    if args.only in (None, "finish"):
        run_report["steps"]["bootstrap_finish_val"] = bootstrap_validation_set(
            finish_ds,
            name="finish",
            min_val_per_class=1,
        )

    if args.only in (None, "identity"):
        id_health = check_explicit_dataset(
            identity_ds,
            name="identity",
            min_images_per_class_warn=cfg["health"]["min_images_per_class_warn"],
            min_classes_warn=cfg["health"]["min_classes_warn"],
        )
        run_report["steps"]["dataset_identity"] = id_health
        if not id_health.get("ok"):
            write_json(run_report_path, run_report)
            print("Identity dataset health check FAILED.")
            sys.exit(1)

    if args.only in (None, "finish"):
        fin_health = check_explicit_dataset(
            finish_ds,
            name="finish",
            min_images_per_class_warn=cfg["health"]["min_images_per_class_warn"],
            min_classes_warn=cfg["health"]["min_classes_warn"],
        )
        run_report["steps"]["dataset_finish"] = fin_health
        if not fin_health.get("ok"):
            write_json(run_report_path, run_report)
            print("Finish dataset health check FAILED.")
            sys.exit(1)

    # ── Cache datasets locally ────────────────────────────────────────────────
    local_identity_ds, local_finish_ds, cache_root = _cache_datasets_locally(
        identity_ds=identity_ds,
        finish_ds=finish_ds,
        run_id=run_id,
        only=args.only,
    )

    try:
        # ── [2/6] Train ───────────────────────────────────────────────────────
        print("\n[2/6] Training...\n")

        if cfg.get("identity", {}).get("enabled", True) and args.only in (None, "identity"):
            out_dir = models_dir / "identity"
            train_res = train_explicit_classifier(
                dataset_root=local_identity_ds,
                out_dir=out_dir,
                image_size=int(cfg["image_size"]),
                batch_size=int(cfg["batch_size"]),
                seed=int(cfg["seed"]),
                epochs=int(cfg["identity"]["epochs"]),
                learning_rate=float(cfg["identity"]["learning_rate"]),
                fine_tune_at_epoch=int(cfg["identity"]["fine_tune_at_epoch"]),
                fine_tune_lr=float(cfg["identity"]["fine_tune_lr"]),
                label_smoothing=float(cfg["identity"]["label_smoothing"]),
                dropout=float(cfg["identity"]["dropout"]),
                run_name=f"identity_{run_id}",
            )
            run_report["steps"]["train_identity"] = train_res
            if not train_res.get("ok"):
                write_json(run_report_path, run_report)
                sys.exit(1)

        if cfg.get("finish", {}).get("enabled", True) and args.only in (None, "finish"):
            out_dir = models_dir / "finish"
            train_res = train_explicit_classifier(
                dataset_root=local_finish_ds,
                out_dir=out_dir,
                image_size=int(cfg["image_size"]),
                batch_size=int(cfg["batch_size"]),
                seed=int(cfg["seed"]),
                epochs=int(cfg["finish"]["epochs"]),
                learning_rate=float(cfg["finish"]["learning_rate"]),
                fine_tune_at_epoch=int(cfg["finish"]["fine_tune_at_epoch"]),
                fine_tune_lr=float(cfg["finish"]["fine_tune_lr"]),
                label_smoothing=float(cfg["finish"]["label_smoothing"]),
                dropout=float(cfg["finish"]["dropout"]),
                run_name=f"finish_{run_id}",
            )
            run_report["steps"]["train_finish"] = train_res
            if not train_res.get("ok"):
                write_json(run_report_path, run_report)
                sys.exit(1)

        # ── [3/6] Evaluate ────────────────────────────────────────────────────
        print("\n[3/6] Evaluating...\n")

        if args.only in (None, "identity"):
            model_dir = models_dir / "identity"
            eval_res = evaluate_classifier(
                model_path=model_dir / "model.keras",
                labels_path=model_dir / "labels.json",
                dataset_root=local_identity_ds,
                image_size=int(cfg["image_size"]),
                batch_size=int(cfg["batch_size"]),
                out_dir=reports_dir / "identity" / run_id,
            )
            run_report["steps"]["eval_identity"] = eval_res

        if args.only in (None, "finish"):
            model_dir = models_dir / "finish"
            eval_res = evaluate_classifier(
                model_path=model_dir / "model.keras",
                labels_path=model_dir / "labels.json",
                dataset_root=local_finish_ds,
                image_size=int(cfg["image_size"]),
                batch_size=int(cfg["batch_size"]),
                out_dir=reports_dir / "finish" / run_id,
            )
            run_report["steps"]["eval_finish"] = eval_res

        # ── [4/6] Export ──────────────────────────────────────────────────────
        if args.no_export:
            print("\n[4/6] Export skipped (--no-export)\n")
        else:
            print("\n[4/6] Exporting models...\n")

            export_cfg = cfg.get("export", {})
            do_fp16 = bool(export_cfg.get("tflite_fp16", True))
            do_int8 = bool(export_cfg.get("tflite_int8", False))
            do_tfjs = bool(export_cfg.get("tfjs", True))

            if args.only in (None, "identity"):
                model_dir = models_dir / "identity"
                if do_fp16 or do_int8:
                    run_report["steps"]["tflite_identity"] = export_tflite_bundle(
                        model_path=model_dir / "model.keras",
                        out_dir=model_dir,
                        make_fp16=do_fp16,
                        make_int8=do_int8,
                        representative_dir=local_identity_ds / "train",
                        image_size=int(cfg["image_size"]),
                    )
                if do_tfjs:
                    run_report["steps"]["tfjs_identity"] = export_tfjs_graph_model(
                        savedmodel_dir=model_dir / "savedmodel",
                        out_dir=tfjs_dir / "identity",
                    )

            if args.only in (None, "finish"):
                model_dir = models_dir / "finish"
                if do_fp16 or do_int8:
                    run_report["steps"]["tflite_finish"] = export_tflite_bundle(
                        model_path=model_dir / "model.keras",
                        out_dir=model_dir,
                        make_fp16=do_fp16,
                        make_int8=do_int8,
                        representative_dir=local_finish_ds / "train",
                        image_size=int(cfg["image_size"]),
                    )
                if do_tfjs:
                    run_report["steps"]["tfjs_finish"] = export_tfjs_graph_model(
                        savedmodel_dir=model_dir / "savedmodel",
                        out_dir=tfjs_dir / "finish",
                    )

    finally:
        _cleanup_local_cache(cache_root)

    run_report["ok"] = True
    run_report["finishedAt"] = now_iso()
    write_json(run_report_path, run_report)

    print("\n[6/6] DONE ✅")
    print(f"Run report: {run_report_path}")


if __name__ == "__main__":
    main()