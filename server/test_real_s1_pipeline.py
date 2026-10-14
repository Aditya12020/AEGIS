import io
import json
import os
import urllib.request
import urllib.parse
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

client_id = os.getenv("COPERNICUS_DATASPACE_CLIENT_ID")
client_secret = os.getenv("COPERNICUS_DATASPACE_CLIENT_SECRET")

# 1. Get token
token_url = "https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token"
token_data = urllib.parse.urlencode({
    "grant_type": "client_credentials",
    "client_id": client_id,
    "client_secret": client_secret,
}).encode("utf-8")

req = urllib.request.Request(token_url, data=token_data, headers={"Content-Type": "application/x-www-form-urlencoded"})
with urllib.request.urlopen(req) as resp:
    token_json = json.loads(resp.read().decode("utf-8"))
    token = token_json["access_token"]

# 2. Call Sentinel Hub Process API for real S1 GRD
process_url = "https://sh.dataspace.copernicus.eu/api/v1/process"
process_body = json.dumps({
    "input": {
        "bounds": {
            "bbox": [68.75, 21.65, 69.25, 22.05]
        },
        "data": [{
            "type": "sentinel-1-grd",
            "dataFilter": {
                "timeRange": {
                    "from": "2026-08-01T00:00:00Z",
                    "to": "2026-09-05T00:00:00Z"
                }
            }
        }]
    },
    "output": {
        "width": 256,
        "height": 256,
        "responses": [{
            "identifier": "default",
            "format": { "type": "image/tiff" }
        }]
    },
    "evalscript": """//VERSION=3
function setup() {
  return {
    input: ["VV", "VH"],
    output: { bands: 3, sampleType: "FLOAT32" }
  };
}
function evaluatePixel(sample) {
  var ratio = (sample.VV > 0 && sample.VH > 0) ? (sample.VH / sample.VV) : 0;
  return [sample.VV, sample.VH, ratio];
}
"""
}).encode("utf-8")

preq = urllib.request.Request(
    process_url,
    data=process_body,
    headers={
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "Accept": "image/tiff",
    }
)

with urllib.request.urlopen(preq) as presp:
    tiff_bytes = presp.read()
    print(f"Acquired TIFF bytes: {len(tiff_bytes)}")

# 3. Read with rasterio
import rasterio
with rasterio.open(io.BytesIO(tiff_bytes)) as dataset:
    print(f"Rasterio bands count: {dataset.count}")
    print(f"Rasterio shape: {dataset.shape}")
    print(f"Rasterio CRS: {dataset.crs}")
    print(f"Rasterio bounds: {dataset.bounds}")
    data = dataset.read()
    print(f"Data shape: {data.shape}, dtype: {data.dtype}")
    print(f"Band 1 min/max: {data[0].min():.4f} / {data[0].max():.4f}")
    print(f"Band 2 min/max: {data[1].min():.4f} / {data[1].max():.4f}")
    print(f"Band 3 min/max: {data[2].min():.4f} / {data[2].max():.4f}")

# 4. Test inference with this real data!
from ml.inference import infer_channels
result = infer_channels(
    channels=data,
    bbox=(21.65, 68.75, 22.05, 69.25),
    scene_id="S1_LIVE_TEST_SCENE",
    allow_unverified=True,
)
print("INFERENCE RESULT:")
print(json.dumps(result, indent=2))
