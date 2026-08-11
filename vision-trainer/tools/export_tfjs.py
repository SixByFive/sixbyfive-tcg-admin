# FILE: tools/export_tfjs.py
#
# UPDATED (2026-03-04) — GRAPH MODEL EXPORT
#
# Exports a SavedModel to TFJS **GraphModel** format (model.json + weight shards).
# Uses ONLY tensorflow and numpy — both already in your training venv.
#
#   ❌ tensorflowjs pip  — NOT used (requires uvloop on some platforms)
#   ❌ uvloop             — NOT used
#   ❌ Node.js            — NOT used
#   ❌ subprocess calls   — NONE
#
# WHY GRAPH MODEL (not LayersModel):
#   LayersModel serializes the Keras layer config, which includes TFOpLambda
#   layers from MobileNetV3's hard-swish activation. TFJS can't deserialize
#   TFOpLambda without custom registration, and even with it, reconstructing
#   a 229-layer Keras graph is very slow (~minutes).
#
#   GraphModel serializes the TF execution graph (GraphDef) which is just
#   raw ops (Conv2D, Add, Mul, etc.) — no Keras layer classes, no TFOpLambda.
#   It loads in seconds and runs identically.
#
# Browser loading:
#   const model = await tf.loadGraphModel(ioHandler);
#   const output = model.predict(inputTensor);
#
# HOW IT WORKS:
#   1. Load the SavedModel and get the serving signature's concrete function
#   2. Freeze the graph (bake variable values into Const nodes)
#   3. Extract weight data from large Const nodes → binary shards
#   4. Strip weight data from topology (TFJS loads weights from shards)
#   5. Convert GraphDef protobuf to JSON
#   6. Write model.json with format="graph-model" + weightsManifest + signature
#
# CHANGES vs previous version:
# - REWRITE: Export GraphModel instead of LayersModel
# - FIX: No more TFOpLambda issue — GraphDef has no Keras layer classes
# - FIX: Browser loading is 10-100x faster (no layer reconstruction)
# - KEEP: Same function signature (export_tfjs_graph_model)
# - KEEP: Copies labels.json into output dir
# - KEEP: Cleans output dir to avoid stale shards

import json
import shutil
from pathlib import Path
from typing import Any, Dict, List, Set, Tuple

import numpy as np


def _write_json(p: Path, obj: Any):
    p.parent.mkdir(parents=True, exist_ok=True)
    with p.open("w", encoding="utf-8") as f:
        json.dump(obj, f)


# TF dtype enum int → TFJS dtype string
_TF_DTYPE_ENUM_TO_TFJS = {
    1: "float32",    # DT_FLOAT
    2: "float32",    # DT_DOUBLE → cast
    3: "int32",      # DT_INT32
    4: "int32",      # DT_UINT8 → cast
    6: "int32",      # DT_INT8 → cast
    9: "int32",      # DT_INT64 → cast
    10: "bool",      # DT_BOOL
    14: "float32",   # DT_BFLOAT16 → cast
    17: "float32",   # DT_HALF → cast
}


def _numpy_dtype_for_tfjs(tfjs_dtype: str):
    return {"float32": np.float32, "int32": np.int32, "bool": np.bool_}.get(
        tfjs_dtype, np.float32
    )


# ---------------------------------------------------------------------------
# Freeze graph: variables → Const nodes
# ---------------------------------------------------------------------------

def _freeze_concrete_fn(concrete_fn):
    """
    Freeze a ConcreteFunction: replace ReadVariableOp with Const nodes.
    Returns the frozen ConcreteFunction (not just the graph_def) so we
    can extract correct input/output tensor names from it.
    """
    from tensorflow.python.framework import convert_to_constants

    return convert_to_constants.convert_variables_to_constants_v2(
        concrete_fn,
        lower_control_flow=False,
    )


# ---------------------------------------------------------------------------
# Extract weights from frozen Const nodes → binary shards
# ---------------------------------------------------------------------------

def _extract_weights(
    graph_def,
    out_dir: Path,
    shard_size_bytes: int = 4 * 1024 * 1024,
    min_weight_bytes: int = 128,
) -> Tuple[List[dict], Set[str]]:
    """
    Extract weight tensors from Const nodes in the frozen graph.

    Small constants (scalars, shapes, small params) stay inline.
    Large constants (conv kernels, dense weights, BN params) are extracted
    to binary shard files and referenced in weightsManifest.

    Returns:
        weights_manifest: TFJS weightsManifest array
        weight_node_names: set of node names that were extracted
    """
    import tensorflow as tf

    weight_specs = []
    raw_chunks = []
    weight_node_names = set()

    for node in graph_def.node:
        if node.op != "Const":
            continue

        value_attr = node.attr.get("value")
        if value_attr is None or not value_attr.HasField("tensor"):
            continue

        tensor_proto = value_attr.tensor

        try:
            arr = tf.make_ndarray(tensor_proto)
        except Exception:
            continue

        if arr.nbytes < min_weight_bytes:
            continue

        # Map to TFJS-compatible dtype
        tfjs_dtype = _TF_DTYPE_ENUM_TO_TFJS.get(tensor_proto.dtype, "float32")
        np_dtype = _numpy_dtype_for_tfjs(tfjs_dtype)
        arr = arr.astype(np_dtype, copy=False)

        weight_specs.append({
            "name": node.name,
            "shape": list(arr.shape),
            "dtype": tfjs_dtype,
        })
        raw_chunks.append(arr.tobytes())
        weight_node_names.add(node.name)

    # Concatenate all weight bytes, then split into shards
    blob = b"".join(raw_chunks)
    total = len(blob)
    num_shards = max(1, -(-total // shard_size_bytes))

    shard_names = []
    for i in range(num_shards):
        lo = i * shard_size_bytes
        hi = min(lo + shard_size_bytes, total)
        name = f"group1-shard{i + 1}of{num_shards}.bin"
        (out_dir / name).write_bytes(blob[lo:hi])
        shard_names.append(name)

    weights_manifest = [{
        "paths": shard_names,
        "weights": weight_specs,
    }]

    return weights_manifest, weight_node_names


# ---------------------------------------------------------------------------
# GraphDef → TFJS JSON + strip weight data from topology
# ---------------------------------------------------------------------------

def _graphdef_to_json(graph_def) -> dict:
    """Convert a TF GraphDef protobuf to JSON dict using protobuf lib."""
    from google.protobuf import json_format

    return json_format.MessageToDict(
        graph_def,
        preserving_proto_field_name=True,
    )


def _strip_weight_data(graph_json: dict, weight_names: Set[str]) -> dict:
    """
    Remove tensor_content / float_val / int_val etc. from Const nodes
    whose weight data was extracted to binary shards. Keep dtype + shape
    so TFJS knows how to map the binary data back.
    """
    for node in graph_json.get("node", []):
        if node.get("name") not in weight_names:
            continue

        attr = node.get("attr", {})
        value_attr = attr.get("value", {})
        tensor = value_attr.get("tensor", {})

        # Keep only dtype and shape
        cleaned = {}
        if "dtype" in tensor:
            cleaned["dtype"] = tensor["dtype"]
        if "tensorShape" in tensor:
            cleaned["tensorShape"] = tensor["tensorShape"]
        elif "tensor_shape" in tensor:
            cleaned["tensorShape"] = tensor["tensor_shape"]

        attr["value"] = {"tensor": cleaned}

    return graph_json


# ---------------------------------------------------------------------------
# Signature extraction (from frozen function + graph)
# ---------------------------------------------------------------------------

def _extract_signature_from_frozen(frozen_fn, frozen_graph_def) -> dict:
    """
    Extract input/output tensor names from the FROZEN concrete function.

    After freezing, output tensor names change (e.g. "dense_1" → "Identity").
    We must use the frozen function's actual tensor names so TFJS can find
    the correct graph nodes.

    TFJS signature format:
      inputs:  { key: { name: "node_name:0", dtype: "DT_FLOAT", tensorShape: {...} } }
      outputs: { key: { name: "node_name:0", dtype: "DT_FLOAT", tensorShape: {...} } }

    The "name" field must match a node in the frozen GraphDef (without ":0" suffix
    for TFJS — it strips the port number internally).
    """
    sig = {"inputs": {}, "outputs": {}}

    # Build set of valid node names in the frozen graph
    valid_nodes = {n.name for n in frozen_graph_def.node}

    # Inputs: use the frozen function's inputs (skip resource handles)
    input_idx = 0
    for arg in frozen_fn.inputs:
        if arg.dtype.name == "resource":
            continue

        tensor_name = arg.name  # e.g. "input_4:0"
        node_name = tensor_name.split(":")[0]  # "input_4"
        key = f"input_{input_idx}"
        input_idx += 1

        dims = []
        if arg.shape.rank is not None:
            for d in arg.shape.as_list():
                dims.append({"size": str(d) if d is not None else "-1"})

        sig["inputs"][key] = {
            "name": node_name,
            "dtype": f"DT_{arg.dtype.name.upper()}",
            "tensorShape": {"dim": dims},
        }

    # Outputs: use the frozen function's outputs
    # These have the correct post-freeze names (e.g. "Identity:0")
    for i, output_tensor in enumerate(frozen_fn.outputs):
        tensor_name = output_tensor.name  # e.g. "Identity:0"
        node_name = tensor_name.split(":")[0]  # "Identity"
        key = f"output_{i}"

        dims = []
        if output_tensor.shape.rank is not None:
            for d in output_tensor.shape.as_list():
                dims.append({"size": str(d) if d is not None else "-1"})

        sig["outputs"][key] = {
            "name": node_name,
            "dtype": f"DT_{output_tensor.dtype.name.upper()}",
            "tensorShape": {"dim": dims},
        }

    return sig


# ---------------------------------------------------------------------------
# Public API (same function name — drop-in replacement)
# ---------------------------------------------------------------------------

def export_tfjs_graph_model(savedmodel_dir: Path, out_dir: Path):
    """
    Export a SavedModel to TFJS GraphModel format.

    Args:
        savedmodel_dir: Path to the savedmodel/ directory (contains saved_model.pb).
        out_dir:        Where to write model.json + *.bin shards.
    """
    import tensorflow as tf

    savedmodel_dir = Path(savedmodel_dir)
    out_dir = Path(out_dir)

    # --- Locate saved_model.pb ---
    if not (savedmodel_dir / "saved_model.pb").exists():
        alt = savedmodel_dir / "savedmodel"
        if (alt / "saved_model.pb").exists():
            savedmodel_dir = alt
        else:
            return {
                "ok": False,
                "error": f"No saved_model.pb found in {savedmodel_dir}",
            }

    # --- Clean output ---
    if out_dir.exists():
        shutil.rmtree(out_dir, ignore_errors=True)
    out_dir.mkdir(parents=True, exist_ok=True)

    try:
        # 1. Load SavedModel
        print(f"[export_tfjs] Loading SavedModel from {savedmodel_dir}")
        loaded = tf.saved_model.load(str(savedmodel_dir))

        # 2. Get serving signature
        if not hasattr(loaded, 'signatures') or 'serving_default' not in loaded.signatures:
            return {"ok": False, "error": "No 'serving_default' signature in SavedModel"}

        concrete_fn = loaded.signatures['serving_default']

        # 3. Freeze graph (variables → Const nodes)
        #    Must freeze BEFORE extracting signature, because freezing
        #    changes the output node names (e.g. "dense_1" → "Identity")
        print("[export_tfjs] Freezing graph…")
        frozen_fn = _freeze_concrete_fn(concrete_fn)
        frozen_graph_def = frozen_fn.graph.as_graph_def()
        n_nodes = len(frozen_graph_def.node)
        print(f"[export_tfjs] Frozen graph: {n_nodes} nodes")

        # 4. Extract signature from the FROZEN function
        #    This ensures input/output names match actual frozen graph nodes
        signature = _extract_signature_from_frozen(frozen_fn, frozen_graph_def)
        print(f"[export_tfjs] Inputs:  {signature['inputs']}")
        print(f"[export_tfjs] Outputs: {signature['outputs']}")

        # 5. Extract weights from Const nodes → binary shards
        #    Use min_weight_bytes=0 to extract ALL constants (including small
        #    scalars, padding arrays, reduction indices). This avoids issues
        #    with protobuf JSON serialization losing tensor data for inline
        #    constants, which causes TFJS to treat them as missing inputs.
        print("[export_tfjs] Extracting weights…")
        weights_manifest, weight_names = _extract_weights(
            frozen_graph_def, out_dir, min_weight_bytes=0
        )
        total_bytes = sum(f.stat().st_size for f in out_dir.glob("*.bin"))
        print(f"[export_tfjs] {len(weight_names)} weight tensors → "
              f"{total_bytes / 1024 / 1024:.1f} MB in shards")

        # 6. Convert GraphDef to JSON
        print("[export_tfjs] Converting topology…")
        graph_json = _graphdef_to_json(frozen_graph_def)

        # 7. Strip weight data from topology (TFJS loads from shards)
        graph_json = _strip_weight_data(graph_json, weight_names)

        # 7b. Ensure "versions" exists — TFJS requires topology.versions.producer
        if "versions" not in graph_json or not graph_json["versions"]:
            graph_json["versions"] = {"producer": 1}

        # 8. Write model.json
        model_json = {
            "format": "graph-model",
            "generatedBy": "sbf-vision-trainer (pure-python graph export)",
            "convertedBy": None,
            "modelTopology": graph_json,
            "weightsManifest": weights_manifest,
            "signature": signature,
        }
        _write_json(out_dir / "model.json", model_json)
        print(f"[export_tfjs] Wrote {out_dir / 'model.json'}")

    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"ok": False, "error": f"TFJS graph export failed: {e}"}

    # --- Copy labels.json ---
    model_parent = savedmodel_dir.parent
    labels_path = model_parent / "labels.json"
    if labels_path.exists():
        shutil.copy2(str(labels_path), str(out_dir / "labels.json"))

    # --- Report ---
    shard_files = sorted(out_dir.glob("*.bin"))

    return {
        "ok": True,
        "outDir": str(out_dir),
        "modelJsonPath": str(out_dir / "model.json"),
        "shardFiles": [str(f) for f in shard_files],
        "totalWeightBytes": total_bytes,
        "format": "graph-model",
        "loadedFrom": str(savedmodel_dir),
        "loadWith": "tf.loadGraphModel(ioHandler)",
        "converterKind": "pure_python_graph",
        "converterDetail": (
            "SavedModel → frozen GraphDef → TFJS GraphModel "
            "(no Keras layers, no TFOpLambda, no tensorflowjs pip)"
        ),
    }