from fastapi import FastAPI, File, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional

from .inference import checkpoint_self_test, model_metadata, run_sar_segmentation

app = FastAPI(
    title="AEGIS SAR Oil Spill ML Service",
    description="PyTorch U-Net inference using the supplied unet_oilspill.pth checkpoint.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


class SegmentRequest(BaseModel):
    sceneId: str = Field(..., min_length=1)
    minLat: float
    minLon: float
    maxLat: float
    maxLon: float
    threshold: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    allowUnverified: bool = False


@app.get("/health")
def health():
    try:
        meta = model_metadata()
        return {
            "status": "ONLINE",
            "service": "AEGIS PyTorch U-Net Segmentation Service",
            **meta,
        }
    except Exception as exc:
        return {
            "status": "DEGRADED",
            "error": str(exc),
        }


@app.get("/model-info")
def model_info():
    return model_metadata()


@app.get("/self-test")
def self_test():
    return checkpoint_self_test()


@app.post("/predict")
@app.post("/segment")
def segment_aoi(payload: SegmentRequest):
    # JSON segmentation is intentionally disabled unless real 3-channel input
    # is supplied through a future raster adapter. This endpoint must not invent SAR.
    raise HTTPException(
        status_code=422,
        detail=(
            "Real raster input is required. JSON AOI-only inference is disabled "
            "because synthetic SAR fallback is prohibited."
        ),
    )


@app.post("/upload")
async def upload_sar_image(
    file: UploadFile = File(...),
    minLat: float = Query(...),
    minLon: float = Query(...),
    maxLat: float = Query(...),
    maxLon: float = Query(...),
    threshold: Optional[float] = Query(None, ge=0.0, le=1.0),
    allowUnverified: bool = Query(False),
):
    contents = await file.read()
    if not contents:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    try:
        return run_sar_segmentation(
            sar_image_bytes=contents,
            bbox=(minLat, minLon, maxLat, maxLon),
            scene_id=file.filename or "UPLOADED_SAR_SCENE",
            threshold=threshold,
            allow_unverified=allowUnverified,
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=409, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("ml.main:app", host="127.0.0.1", port=8000, reload=False)
