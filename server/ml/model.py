import hashlib
import os
from typing import List, Tuple

import torch
import torch.nn as nn
import torch.nn.functional as F
from torchvision.models import resnet34


MODEL_NAME = "unet_oilspill.pth"
MODEL_VERSION = "checkpoint-unverified"
MODEL_ARCHITECTURE = "U-Net with ResNet-34 encoder"
MODEL_INPUT_CHANNELS = 3
MODEL_OUTPUT_CHANNELS = 1
MODEL_INPUT_SIZE = int(os.getenv("AEGIS_UNET_INPUT_SIZE", "256"))  # operational default; training size is not stored in checkpoint


class DecoderBlock(nn.Module):
    """Segmentation-models-pytorch compatible U-Net decoder block."""

    def __init__(self, in_channels: int, skip_channels: int, out_channels: int):
        super().__init__()
        self.conv1 = nn.Sequential(
            nn.Conv2d(in_channels + skip_channels, out_channels, kernel_size=3, padding=1, bias=False),
            nn.BatchNorm2d(out_channels),
            nn.ReLU(inplace=True),
        )
        self.conv2 = nn.Sequential(
            nn.Conv2d(out_channels, out_channels, kernel_size=3, padding=1, bias=False),
            nn.BatchNorm2d(out_channels),
            nn.ReLU(inplace=True),
        )

    def forward(self, x: torch.Tensor, skip: torch.Tensor | None = None) -> torch.Tensor:
        x = F.interpolate(x, scale_factor=2, mode="nearest")
        if skip is not None:
            if x.shape[-2:] != skip.shape[-2:]:
                x = F.interpolate(x, size=skip.shape[-2:], mode="nearest")
            x = torch.cat([x, skip], dim=1)
        return self.conv2(self.conv1(x))


class UNetOilSpill(nn.Module):
    """
    Architecture reconstructed from the supplied checkpoint.

    The checkpoint state_dict proves:
      - ResNet-34-style encoder
      - 3 input channels
      - 1 output channel
      - decoder widths 256/128/64/32/16

    The checkpoint does NOT contain training-data/preprocessing metadata.
    Therefore those assumptions are intentionally not embedded here.
    """

    def __init__(self, in_channels: int = 3, out_channels: int = 1):
        super().__init__()
        if in_channels != 3:
            raise ValueError("The supplied checkpoint has a 3-channel first convolution.")
        if out_channels != 1:
            raise ValueError("The supplied checkpoint has a single-channel segmentation head.")

        encoder = resnet34(weights=None)
        # Keep torchvision module names aligned with the supplied state_dict.
        encoder.conv1 = nn.Conv2d(3, 64, kernel_size=7, stride=2, padding=3, bias=False)
        encoder.fc = nn.Identity()
        self.encoder = encoder

        self.decoder = nn.Module()
        self.decoder.blocks = nn.ModuleList([
            DecoderBlock(512, 256, 256),
            DecoderBlock(256, 128, 128),
            DecoderBlock(128, 64, 64),
            DecoderBlock(64, 64, 32),
            DecoderBlock(32, 0, 16),
        ])
        self.segmentation_head = nn.Sequential(
            nn.Conv2d(16, 1, kernel_size=3, padding=1)
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # ResNet feature pyramid:
        # 1/2 stem -> 1/4 layer1 -> 1/8 layer2 -> 1/16 layer3 -> 1/32 layer4.
        x0 = self.encoder.conv1(x)
        x0 = self.encoder.bn1(x0)
        x0 = self.encoder.relu(x0)
        x1 = self.encoder.maxpool(x0)
        x1 = self.encoder.layer1(x1)
        x2 = self.encoder.layer2(x1)
        x3 = self.encoder.layer3(x2)
        x4 = self.encoder.layer4(x3)

        x = self.decoder.blocks[0](x4, x3)
        x = self.decoder.blocks[1](x, x2)
        x = self.decoder.blocks[2](x, x1)
        x = self.decoder.blocks[3](x, x0)
        x = self.decoder.blocks[4](x, None)

        # SMP-style U-Net upsamples the decoder output to input spatial size.
        x = F.interpolate(x, size=(MODEL_INPUT_SIZE, MODEL_INPUT_SIZE), mode="nearest")
        return self.segmentation_head(x)


def load_checkpoint_state_dict(path: str) -> Tuple[UNetOilSpill, str]:
    checkpoint = torch.load(path, map_location="cpu", weights_only=True)
    if not isinstance(checkpoint, dict):
        raise ValueError("Unsupported checkpoint format: expected a state_dict mapping.")

    model = UNetOilSpill()
    missing, unexpected = model.load_state_dict(checkpoint, strict=False)
    if missing or unexpected:
        raise ValueError(
            f"Checkpoint architecture mismatch. missing={missing}, unexpected={unexpected}"
        )
    model.eval()
    checksum = get_state_dict_checksum(checkpoint)
    return model, checksum


def get_state_dict_checksum(state_dict: dict) -> str:
    hasher = hashlib.sha256()
    for key in sorted(state_dict.keys()):
        hasher.update(key.encode("utf-8"))
        hasher.update(state_dict[key].detach().cpu().contiguous().numpy().tobytes())
    return hasher.hexdigest()


def get_model_checksum(model: nn.Module) -> str:
    return get_state_dict_checksum(model.state_dict())
