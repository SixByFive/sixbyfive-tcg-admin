# SBF Vision Trainer

Trains:
- Identity classifier (set-number) from datasets/identity_explicit
- Finish classifier (finish type) from datasets/finish_explicit

Outputs into your Vision Lab Workspace:
- models/identity + models/finish (Keras + TFLite)
- tfjs/identity + tfjs/finish
- reports/ (metrics + confusion matrix)

## Install

```bash
pip install -r requirements.txt