import io
import os
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import torch
from PIL import Image
import rasterio

from .model import (
    MODEL_ARCHITECTURE,
    MODEL_INPUT_CHANNELS,
    MODEL_INPUT_SIZE,
    MODEL_NAME,
    MODEL_OUTPUT_CHANNELS,
    MODEL_VERSION,
    UNetOilSpill,
    get_model_checksum,
    load_checkpoint_state_dict,
)

MODEL_PATH = Path(__file__).resolve().parent / "weights" / "unet_oilspill.pth"
COMPATIBILITY_VERIFIED = os.getenv("AEGIS_UNET_COMPATIBILITY_VERIFIED", "").lower() == "true"
MODEL_THRESHOLD = float(os.getenv("AEGIS_UNET_THRESHOLD", "0.5"))

_model_instance: Optional[UNetOilSpill] = None
_model_checksum: Optional[str] = None


def get_or_load_model() -> Tuple[UNetOilSpill, str]:
    global _model_instance, _model_checksum
    if _model_instance is None:
        if not MODEL_PATH.exists():
            raise FileNotFoundError(f"U-Net checkpoint not found: {MODEL_PATH}")
        _model_instance, _model_checksum = load_checkpoint_state_dict(str(MODEL_PATH))
    return _model_instance, _model_checksum


def model_metadata() -> Dict[str, Any]:
    _, checksum = get_or_load_model()
    return {
        "modelName": MODEL_NAME,
        "modelVersion": MODEL_VERSION,
        "architecture": MODEL_ARCHITECTURE,
        "weightsChecksumSha256": checksum,
        "inputChannels": MODEL_INPUT_CHANNELS,
        "outputChannels": MODEL_OUTPUT_CHANNELS,
        "inputImageSize": [MODEL_INPUT_SIZE, MODEL_INPUT_SIZE],
        "normalization": "Per-channel 2nd-98th percentile min-max normalization into [0, 1]",
        "threshold": MODEL_THRESHOLD,
        "compatibilityStatus": "VERIFIED" if COMPATIBILITY_VERIFIED else "MODEL COMPATIBILITY UNVERIFIED",
    }


def _normalize_channels(channels: np.ndarray) -> np.ndarray:
    """
    Normalizes multi-channel SAR rasters to [0, 1] using robust percentile clipping.
    """
    out = channels.astype(np.float32)
    for i in range(out.shape[0]):
        band = out[i]
        finite = np.isfinite(band)
        if not finite.any():
            raise ValueError(f"Input channel {i + 1} contains no finite pixels.")
        lo = float(np.nanpercentile(band[finite], 2))
        hi = float(np.nanpercentile(band[finite], 98))
        if hi <= lo:
            hi = lo + 1e-6
        out[i] = np.clip((band - lo) / (hi - lo), 0.0, 1.0)
    return out


def _load_image_bytes(contents: bytes) -> np.ndarray:
    """
    Loads raster bytes either using rasterio (for GeoTIFF) or PIL (for standard imagery).
    Returns a [3, H, W] float32 numpy array.
    """
    # Check if TIFF header is present
    if contents.startswith(b"II*\x00") or contents.startswith(b"MM\x00*"):
        try:
            with rasterio.open(io.BytesIO(contents)) as ds:
                data = ds.read().astype(np.float32)
                if data.shape[0] == 3:
                    return data
                elif data.shape[0] == 2:
                    # Dual-pol: Band 1=VV, Band 2=VH. Channel 3 = VH/VV ratio
                    vv = data[0]
                    vh = data[1]
                    ratio = np.where((vv > 0) & (vh > 0), vh / vv, 0.0).astype(np.float32)
                    return np.stack([vv, vh, ratio], axis=0)
                elif data.shape[0] == 1:
                    # Single-pol replicated across 3 channels
                    return np.repeat(data, 3, axis=0)
                elif data.shape[0] > 3:
                    return data[:3]
        except Exception:
            pass

    # Fallback to standard image decoding via PIL
    img = Image.open(io.BytesIO(contents))
    img = img.convert("RGB").resize((MODEL_INPUT_SIZE, MODEL_INPUT_SIZE), Image.Resampling.BILINEAR)
    arr = np.asarray(img, dtype=np.float32) / 255.0
    return np.transpose(arr, (2, 0, 1))


def prepare_model_input(
    channels: np.ndarray,
    *,
    allow_unverified: bool = False,
) -> torch.Tensor:
    if channels.ndim != 3:
        raise ValueError("Expected a [channels, height, width] raster.")
    if channels.shape[0] != MODEL_INPUT_CHANNELS:
        raise ValueError(
            f"Checkpoint requires {MODEL_INPUT_CHANNELS} channels, received {channels.shape[0]}."
        )
    if not COMPATIBILITY_VERIFIED and not allow_unverified:
        raise RuntimeError(
            "MODEL COMPATIBILITY UNVERIFIED: the supplied checkpoint is 3-channel, "
            "but its training data and preprocessing are not included. "
            "Set AEGIS_UNET_COMPATIBILITY_VERIFIED=true only after independently "
            "verifying the training representation and preprocessing."
        )

    channels = _normalize_channels(channels)
    tensor = torch.from_numpy(channels).unsqueeze(0)
    tensor = torch.nn.functional.interpolate(
        tensor, size=(MODEL_INPUT_SIZE, MODEL_INPUT_SIZE), mode="bilinear", align_corners=False
    )
    return tensor


def convex_hull_2d(points: List[Tuple[int, int]]) -> List[Tuple[int, int]]:
    """Computes the 2D convex hull of integer point coordinates using Monotone Chain."""
    pts = sorted(set(points))
    if len(pts) <= 2:
        return pts

    def cross(o: Tuple[int, int], a: Tuple[int, int], b: Tuple[int, int]) -> float:
        return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])

    lower: List[Tuple[int, int]] = []
    for p in pts:
        while len(lower) >= 2 and cross(lower[-2], lower[-1], p) <= 0:
            lower.pop()
        lower.append(p)

    upper: List[Tuple[int, int]] = []
    for p in reversed(pts):
        while len(upper) >= 2 and cross(upper[-2], upper[-1], p) <= 0:
            upper.pop()
        upper.append(p)

    return lower[:-1] + upper[:-1]


def mask_to_contour_polygon(mask: np.ndarray, bbox: Tuple[float, float, float, float]) -> List[List[float]]:
    """
    Extracts a georeferenced boundary polygon for segmented positive pixels
    using 2D convex hull contour mapping.
    """
    min_lat, min_lon, max_lat, max_lon = bbox
    ys, xs = np.where(mask > 0)
    # Require at least 10 positive pixels to filter isolated noise artifacts
    if len(xs) < 10:
        return []

    h, w = mask.shape
    raw_points = list(zip(xs.tolist(), ys.tolist()))
    hull_pts = convex_hull_2d(raw_points)
    if len(hull_pts) < 3:
        return []

    coords = [
        [
            round(min_lon + x / max(1, w - 1) * (max_lon - min_lon), 7),
            round(max_lat - y / max(1, h - 1) * (max_lat - min_lat), 7),
        ]
        for x, y in hull_pts
    ]
    # Close polygon ring
    coords.append(coords[0])
    return coords


def infer_channels(
    channels: np.ndarray,
    bbox: Tuple[float, float, float, float],
    scene_id: str,
    threshold: Optional[float] = None,
    *,
    allow_unverified: bool = False,
) -> Dict[str, Any]:
    model, checksum = get_or_load_model()
    tensor = prepare_model_input(channels, allow_unverified=allow_unverified)
    threshold_value = MODEL_THRESHOLD if threshold is None else float(threshold)

    started = time.time()
    with torch.inference_mode():
        logits = model(tensor)[0, 0].cpu().numpy()
        probability = torch.sigmoid(torch.from_numpy(logits)).numpy()

    binary = probability >= threshold_value
    mask_pixels = int(np.sum(binary))
    total_pixels = int(binary.size)
    coverage_pct = round(float(mask_pixels / total_pixels * 100.0), 4)

    # Physical pixel ground dimension and area computation
    min_lat, min_lon, max_lat, max_lon = bbox
    h, w = binary.shape
    center_lat = (min_lat + max_lat) / 2.0
    lat_dist_km = (max_lat - min_lat) * 111.139
    lon_dist_km = (max_lon - min_lon) * 111.139 * np.cos(np.deg2rad(center_lat))
    dy_km = lat_dist_km / max(1, h)
    dx_km = lon_dist_km / max(1, w)
    pixel_area_km2 = dx_km * dy_km

    coords = mask_to_contour_polygon(binary, bbox)
    spill_detected = bool(len(coords) >= 4 and mask_pixels >= 10)
    area = round(float(mask_pixels * pixel_area_km2), 4) if spill_detected else 0.0

    confidence = float(np.mean(probability[binary])) * 100.0 if spill_detected else 0.0
    clean_ocean_confidence = round(float(np.mean(1.0 - probability)) * 100.0, 2)

    if coords and spill_detected:
        centroid_lon = float(np.mean([p[0] for p in coords[:-1]]))
        centroid_lat = float(np.mean([p[1] for p in coords[:-1]]))
    else:
        centroid_lat = (bbox[0] + bbox[2]) / 2.0
        centroid_lon = (bbox[1] + bbox[3]) / 2.0

    classification = "OIL SPILL DETECTED" if spill_detected else "NO OIL SPILL DETECTED"

    # Structured diagnostic metadata
    diagnostics = {
        "inputStatistics": {
            "tensorShape": list(tensor.shape),
            "dtype": str(tensor.dtype),
            "min": round(float(tensor.min()), 6),
            "max": round(float(tensor.max()), 6),
            "mean": round(float(tensor.mean()), 6),
            "std": round(float(tensor.std()), 6),
            "finiteCount": int(torch.isfinite(tensor).sum()),
            "nanCount": int(torch.isnan(tensor).sum()),
        },
        "outputStatistics": {
            "logits": {
                "min": round(float(np.min(logits)), 6),
                "max": round(float(np.max(logits)), 6),
                "mean": round(float(np.mean(logits)), 6),
                "std": round(float(np.std(logits)), 6),
            },
            "probabilities": {
                "min": round(float(np.min(probability)), 6),
                "p25": round(float(np.percentile(probability, 25)), 6),
                "p50": round(float(np.percentile(probability, 50)), 6),
                "p75": round(float(np.percentile(probability, 75)), 6),
                "p98": round(float(np.percentile(probability, 98)), 6),
                "max": round(float(np.max(probability)), 6),
                "mean": round(float(np.mean(probability)), 6),
                "std": round(float(np.std(probability)), 6),
            },
            "threshold": threshold_value,
            "maskPixelCount": mask_pixels,
            "totalPixelCount": total_pixels,
            "coveragePercent": coverage_pct,
        },
        "geospatial": {
            "bbox": list(bbox),
            "pixelResolutionMeters": [round(dx_km * 1000.0, 1), round(dy_km * 1000.0, 1)],
            "pixelAreaKm2": round(pixel_area_km2, 6),
            "calculatedAreaKm2": area,
        },
    }

    # Structured diagnostic logging to stderr
    import sys
    print(
        f"[U-Net Diagnostics] Scene: {scene_id} | Input mean={diagnostics['inputStatistics']['mean']} | "
        f"Logits range=[{diagnostics['outputStatistics']['logits']['min']}, {diagnostics['outputStatistics']['logits']['max']}] | "
        f"Prob max={diagnostics['outputStatistics']['probabilities']['max']} (tau={threshold_value}) | "
        f"Positive pixels={mask_pixels}/{total_pixels} | Area={area} km² | Result={classification}",
        file=sys.stderr,
    )

    return {
        "status": "SUCCESS",
        "sceneId": scene_id,
        "classification": classification,
        "spillDetected": spill_detected,
        "modelMetadata": {
            **model_metadata(),
            "threshold": threshold_value,
            "inferenceDurationMs": round((time.time() - started) * 1000, 1),
            "maskPixelCount": mask_pixels,
            "totalPixelCount": total_pixels,
            "coveragePercent": coverage_pct,
            "cleanOceanConfidencePercent": clean_ocean_confidence,
            "diagnostics": diagnostics,
        },
        "segmentation": {
            "areaKm2": area,
            "confidencePercent": round(confidence, 2) if spill_detected else 0.0,
            "cleanOceanConfidencePercent": clean_ocean_confidence,
            "centroid": [round(centroid_lat, 7), round(centroid_lon, 7)],
            "polygonGeoJson": {"type": "Polygon", "coordinates": [coords]} if spill_detected else None,
            "provenanceLabel": "MODEL OUTPUT",
            "isModelOutput": True,
            "thicknessMinMicrons": None,
            "thicknessMaxMicrons": None,
            "thicknessProvenance": "DATA UNAVAILABLE",
        },
        "provenance": {
            "sceneId": scene_id,
            "weightsChecksumSha256": checksum,
            "calculation": "U-Net probability thresholding, convex-hull contouring, and physical ground pixel area derivation",
        },
    }


def run_sar_segmentation(
    sar_image_bytes: Optional[bytes] = None,
    bbox: Tuple[float, float, float, float] = (0, 0, 0, 0),
    scene_id: str = "",
    threshold: Optional[float] = None,
    channels: Optional[np.ndarray] = None,
    allow_unverified: bool = False,
) -> Dict[str, Any]:
    if not scene_id:
        raise ValueError("scene_id is required.")
    if channels is None:
        if not sar_image_bytes:
            raise ValueError("Real SAR/model input is required; synthetic input is disabled.")
        channels = _load_image_bytes(sar_image_bytes)

    return infer_channels(
        channels,
        bbox,
        scene_id,
        threshold,
        allow_unverified=allow_unverified,
    )


def checkpoint_self_test() -> Dict[str, Any]:
    model, checksum = get_or_load_model()
    with torch.inference_mode():
        sample = torch.zeros(1, MODEL_INPUT_CHANNELS, MODEL_INPUT_SIZE, MODEL_INPUT_SIZE)
        output = model(sample)
    return {
        "status": "PASS",
        "weightsChecksumSha256": checksum,
        "inputShape": list(sample.shape),
        "outputShape": list(output.shape),
        "compatibilityStatus": "VERIFIED" if COMPATIBILITY_VERIFIED else "MODEL COMPATIBILITY UNVERIFIED",
    }


def generate_raster_preview(tiff_path: str, output_png_path: str) -> str:
    """
    Renders an authentic, georeferenced Sentinel-1 SAR raster into a web-deliverable
    enhanced PNG preview using robust multi-channel percentile scaling.
    """
    out_path = Path(output_png_path)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    try:
        with rasterio.open(tiff_path) as ds:
            data = ds.read().astype(np.float32)
            if data.shape[0] >= 3:
                # RGB composite: R=VV, G=VH, B=Ratio
                bands = []
                for i in range(3):
                    b = data[i]
                    fin = np.isfinite(b)
                    if not fin.any():
                        lo, hi = 0.0, 1.0
                    else:
                        lo = float(np.nanpercentile(b[fin], 2))
                        hi = float(np.nanpercentile(b[fin], 98))
                        if hi <= lo:
                            hi = lo + 1e-6
                    scaled = np.clip((b - lo) / (hi - lo) * 255.0, 0, 255).astype(np.uint8)
                    bands.append(scaled)
                rgb = np.stack(bands, axis=-1)
                img = Image.fromarray(rgb)
            elif data.shape[0] == 2:
                vv = data[0]
                vh = data[1]
                ratio = np.where((vv > 0) & (vh > 0), vh / vv, 0.0).astype(np.float32)
                bands = []
                for b in [vv, vh, ratio]:
                    fin = np.isfinite(b)
                    lo = float(np.nanpercentile(b[fin], 2)) if fin.any() else 0.0
                    hi = float(np.nanpercentile(b[fin], 98)) if fin.any() else 1.0
                    if hi <= lo:
                        hi = lo + 1e-6
                    bands.append(np.clip((b - lo) / (hi - lo) * 255.0, 0, 255).astype(np.uint8))
                rgb = np.stack(bands, axis=-1)
                img = Image.fromarray(rgb)
            else:
                b = data[0]
                fin = np.isfinite(b)
                lo = float(np.nanpercentile(b[fin], 2)) if fin.any() else 0.0
                hi = float(np.nanpercentile(b[fin], 98)) if fin.any() else 1.0
                if hi <= lo:
                    hi = lo + 1e-6
                gray = np.clip((b - lo) / (hi - lo) * 255.0, 0, 255).astype(np.uint8)
                img = Image.fromarray(gray)
            img.save(str(out_path), format="PNG")
            return str(out_path)
    except Exception:
        # Fallback using PIL
        with open(tiff_path, "rb") as f:
            img = Image.open(f)
            img = img.convert("RGB")
            img.save(str(out_path), format="PNG")
            return str(out_path)


if __name__ == "__main__":
    import json
    import sys

    if len(sys.argv) >= 3 and sys.argv[1] == "--preview":
        in_tiff = sys.argv[2]
        out_png = sys.argv[3] if len(sys.argv) > 3 else str(Path(in_tiff).parent / "preview.png")
        try:
            saved = generate_raster_preview(in_tiff, out_png)
            print(json.dumps({"status": "SUCCESS", "previewPath": saved}))
            sys.exit(0)
        except Exception as err:
            print(json.dumps({"status": "ERROR", "message": str(err)}))
            sys.exit(1)

    if len(sys.argv) < 6:
        print(json.dumps({"status": "ERROR", "message": "Usage: python -m ml.inference <tiff_path> <minLat> <minLon> <maxLat> <maxLon> [sceneId]"}))
        sys.exit(1)

    tiff_path = sys.argv[1]
    min_lat = float(sys.argv[2])
    min_lon = float(sys.argv[3])
    max_lat = float(sys.argv[4])
    max_lon = float(sys.argv[5])
    scene_id = sys.argv[6] if len(sys.argv) > 6 else Path(tiff_path).stem

    try:
        # Also ensure a preview is available alongside the tiff
        try:
            preview_target = str(Path(tiff_path).parent / "preview.png")
            if not os.path.exists(preview_target):
                generate_raster_preview(tiff_path, preview_target)
        except Exception:
            pass

        with open(tiff_path, "rb") as f:
            bytes_data = f.read()
        res = run_sar_segmentation(
            sar_image_bytes=bytes_data,
            bbox=(min_lat, min_lon, max_lat, max_lon),
            scene_id=scene_id,
            allow_unverified=True,
        )
        print(json.dumps(res))
    except Exception as err:
        print(json.dumps({"status": "ERROR", "message": str(err)}))
        sys.exit(1)


