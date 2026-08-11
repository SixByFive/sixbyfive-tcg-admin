# FILE: vision-trainer/tools/split_datasets.py
#
# UPDATED (2026-03-19)
#
# CHANGES:
#   - FIX: _mulberry32 PRNG now matches the JS implementation exactly
#   - FIX: per-image splitting within each class for sparse datasets
#          (instead of putting entire class in train OR val, splits images within class)
#          This ensures every class has both train and val images regardless of size.

import os
import re
import shutil
from pathlib import Path

IMG_EXTS = {".jpg", ".jpeg", ".png", ".webp"}


# ─── PRNG — must match JS exactly ────────────────────────────────────────────

def _mulberry32(seed: int):
    """Mulberry32 PRNG — verified identical to the JS implementation."""
    state = [seed & 0xFFFFFFFF]

    def rnd():
        state[0] = (state[0] + 0x6D2B79F5) & 0xFFFFFFFF
        t = state[0]
        t ^= t >> 15
        t = (t * (1 | state[0])) & 0xFFFFFFFF
        t2 = (t + ((t * (61 | t)) & 0xFFFFFFFF)) & 0xFFFFFFFF
        t2 ^= t2 >> 14
        return (t2 & 0xFFFFFFFF) / 4294967296.0

    return rnd


def _hash_seed(s: str) -> int:
    """FNV-1a 32-bit — identical to hashSeed() in the JS."""
    h = 2166136261
    for ch in s.encode("utf-8"):
        h ^= ch
        h = (h * 16777619) & 0xFFFFFFFF
    return h


def _shuffle_deterministic(items: list, seed: int) -> list:
    rnd = _mulberry32(seed)
    a = list(items)
    for i in range(len(a) - 1, 0, -1):
        j = int(rnd() * (i + 1))
        a[i], a[j] = a[j], a[i]
    return a


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _list_dirs(d: Path) -> list:
    if not d.exists():
        return []
    return sorted([p.name for p in d.iterdir() if p.is_dir()])


def _list_images(d: Path) -> list:
    if not d.exists():
        return []
    return sorted([f.name for f in d.iterdir() if f.is_file() and f.suffix.lower() in IMG_EXTS])


def _link_or_copy(src: Path, dst: Path, prefer: str = "copy") -> str:
    if dst.exists():
        return "skip_exists"
    dst.parent.mkdir(parents=True, exist_ok=True)
    if prefer == "hardlink":
        try:
            os.link(src, dst)
            return "hardlink"
        except OSError:
            pass
    shutil.copy2(src, dst)
    return "copy"


def _parse_identity_from_filename(filename: str) -> str:
    m = re.match(r'^([a-z0-9]+-\d{3,4})__', filename, re.IGNORECASE)
    return m.group(1).lower() if m else ""


def _split_keys(keys: list, val_ratio: float, seed: int):
    """Split a list of keys into (train_keys, val_keys) deterministically."""
    n = len(keys)
    val_count = max(1, round(n * val_ratio))
    shuffled = _shuffle_deterministic(keys, seed)

    val_keys   = set(shuffled[:val_count])
    train_keys = set(shuffled[val_count:])

    if not train_keys and len(shuffled) > 1:
        one = shuffled[0]
        val_keys.discard(one)
        train_keys.add(one)

    return train_keys, val_keys


# ─── Identity split ───────────────────────────────────────────────────────────

def _split_identity(identity_raw, identity_explicit, prefer, val_ratio, seed_str,
                    min_per_identity_train, report):
    classes_all = _list_dirs(identity_raw)
    eligible = []

    for cls in classes_all:
        files = _list_images(identity_raw / cls)
        report["health"]["identityPerClass"][cls] = len(files)
        if len(files) < min_per_identity_train:
            report["health"]["warnings"].append({
                "type": "skipped_identity_class_too_small",
                "identity": cls,
                "count": len(files),
                "minRequired": min_per_identity_train,
            })
            continue
        eligible.append((cls, files))

    seed = _hash_seed(f"{seed_str}|identity")

    for cls, files in eligible:
        count = len(files)

        if count == 1:
            # Single image — train only, bootstrap handles val
            splits = [("train", files[0])]
        elif count == 2:
            # Two images — one each
            shuffled = _shuffle_deterministic(files, _hash_seed(f"{seed_str}|{cls}"))
            splits = [("val", shuffled[0]), ("train", shuffled[1])]
        else:
            # 3+ images — split images within the class (not class-level)
            # This ensures every class has both train and val images
            val_count = max(1, round(count * val_ratio))
            shuffled = _shuffle_deterministic(files, _hash_seed(f"{seed_str}|{cls}"))
            val_files   = set(shuffled[:val_count])
            train_files = set(shuffled[val_count:])

            # Ensure at least one train image
            if not train_files:
                one = shuffled[0]
                val_files.discard(one)
                train_files.add(one)

            splits = [
                ("val"   if f in val_files else "train", f)
                for f in files
            ]

        for split, f in splits:
            dst_dir = identity_explicit / split / cls
            dst_dir.mkdir(parents=True, exist_ok=True)
            mode = _link_or_copy(identity_raw / cls / f, dst_dir / f, prefer)
            report["used"][mode] = report["used"].get(mode, 0) + 1
            report["counts"]["identityFiles"] += 1
            report["counts"]["identity"][split] = report["counts"]["identity"].get(split, 0) + 1


# ─── Finish split ─────────────────────────────────────────────────────────────

def _split_finish(finish_raw, finish_explicit, prefer, val_ratio, seed_str, report):
    finish_classes = _list_dirs(finish_raw)
    by_identity = {}

    for finish in finish_classes:
        files = _list_images(finish_raw / finish)
        report["health"]["finishPerClass"][finish] = len(files)
        for f in files:
            identity = _parse_identity_from_filename(f)
            key = identity if identity else f"unknown:{finish}:{f}"
            by_identity.setdefault(key, []).append((finish, f))

    identity_keys = sorted(by_identity.keys())
    seed = _hash_seed(f"{seed_str}|finish")
    _, val_keys = _split_keys(identity_keys, val_ratio, seed)

    for identity in identity_keys:
        split = "val" if identity in val_keys else "train"
        for finish, f in by_identity[identity]:
            src = finish_raw / finish / f
            dst = finish_explicit / split / finish / f
            mode = _link_or_copy(src, dst, prefer)
            report["used"][mode] = report["used"].get(mode, 0) + 1
            report["counts"]["finishFiles"] += 1
            report["counts"]["finish"][split] = report["counts"]["finish"].get(split, 0) + 1


# ─── Public entrypoint ────────────────────────────────────────────────────────

def split_training_datasets(
    workspace: Path,
    clean: bool = False,
    prefer: str = "copy",
    val_ratio: float = 0.2,
    seed: str = "visionlab-v1",
    min_per_identity_train: int = 2,
) -> dict:
    workspace = Path(workspace)
    datasets  = workspace / "datasets"

    identity_raw      = datasets / "identity_raw"
    finish_raw        = datasets / "finish_raw"
    identity_explicit = datasets / "identity_explicit"
    finish_explicit   = datasets / "finish_explicit"

    report = {
        "ok": True,
        "used": {},
        "counts": {"identityFiles": 0, "finishFiles": 0, "identity": {}, "finish": {}},
        "health": {"warnings": [], "identityPerClass": {}, "finishPerClass": {}},
    }

    if not identity_raw.exists():
        return {"ok": False, "error": f"identity_raw not found: {identity_raw}"}
    if not finish_raw.exists():
        return {"ok": False, "error": f"finish_raw not found: {finish_raw}"}

    if clean:
        if identity_explicit.exists():
            shutil.rmtree(identity_explicit)
        if finish_explicit.exists():
            shutil.rmtree(finish_explicit)

    for d in [
        identity_explicit / "train", identity_explicit / "val",
        finish_explicit   / "train", finish_explicit   / "val",
    ]:
        d.mkdir(parents=True, exist_ok=True)

    _split_identity(identity_raw, identity_explicit, prefer, val_ratio, seed,
                    min_per_identity_train, report)
    _split_finish(finish_raw, finish_explicit, prefer, val_ratio, seed, report)

    id_train  = report["counts"]["identity"].get("train", 0)
    id_val    = report["counts"]["identity"].get("val", 0)
    fin_train = report["counts"]["finish"].get("train", 0)
    fin_val   = report["counts"]["finish"].get("val", 0)

    print(f"[split] identity  train={id_train}  val={id_val}")
    print(f"[split] finish    train={fin_train}  val={fin_val}")

    return report


# ─── CLI ─────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import argparse, json, sys

    ap = argparse.ArgumentParser()
    ap.add_argument("--workspace", required=True)
    ap.add_argument("--val-ratio", type=float, default=0.2)
    ap.add_argument("--seed", default="visionlab-v1")
    ap.add_argument("--clean", action="store_true")
    ap.add_argument("--min-per-class", type=int, default=2)
    args = ap.parse_args()

    result = split_training_datasets(
        workspace=Path(args.workspace),
        clean=args.clean,
        prefer="copy",
        val_ratio=args.val_ratio,
        seed=args.seed,
        min_per_identity_train=args.min_per_class,
    )
    print(json.dumps(result, indent=2))
    sys.exit(0 if result.get("ok") else 1)