# FILE: vision-trainer/vision-trainer.spec
#
# SBF Vision Lab Trainer Runtime
#
# PURPOSE:
# - Build the Python training pipeline into a distributable Windows runtime
# - Include TensorFlow and training config files
# - Output a folder-based runtime (onedir), which is safer for TensorFlow than onefile

from PyInstaller.utils.hooks import collect_all

# COLLECT: TensorFlow and key ML package resources
tf_datas, tf_binaries, tf_hiddenimports = collect_all("tensorflow")
np_datas, np_binaries, np_hiddenimports = collect_all("numpy")
sk_datas, sk_binaries, sk_hiddenimports = collect_all("sklearn")
mpl_datas, mpl_binaries, mpl_hiddenimports = collect_all("matplotlib")
pil_datas, pil_binaries, pil_hiddenimports = collect_all("PIL")
yaml_datas, yaml_binaries, yaml_hiddenimports = collect_all("yaml")

a = Analysis(
    ["tools/run_training_pipeline.py"],
    pathex=["tools"],
    binaries=tf_binaries + np_binaries + sk_binaries + mpl_binaries + pil_binaries + yaml_binaries,
    datas=
        tf_datas
        + np_datas
        + sk_datas
        + mpl_datas
        + pil_datas
        + yaml_datas
        + [
            ("config", "config"),
        ],
    hiddenimports=
        tf_hiddenimports
        + np_hiddenimports
        + sk_hiddenimports
        + mpl_hiddenimports
        + pil_hiddenimports
        + yaml_hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
)

pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="vision-trainer",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=True,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name="vision-trainer",
)