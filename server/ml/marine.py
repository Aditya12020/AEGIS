import json
import os
import sys
import tempfile
import math
from dotenv import load_dotenv

load_dotenv()
load_dotenv(os.path.join(os.path.dirname(__file__), "../.env"))

def out(status, **kwargs):
    print(json.dumps({"status": status, **kwargs}))
    raise SystemExit(0)

try:
    import copernicusmarine
    import xarray as xr
except Exception as exc:
    out("DATA_UNAVAILABLE", errorMessage=f"Copernicus Marine dependencies unavailable: {exc}")

if len(sys.argv) != 4:
    out("DATA_UNAVAILABLE", errorMessage="Usage: marine.py <latitude> <longitude> <timestamp>")

lat=float(sys.argv[1]); lon=float(sys.argv[2]); timestamp=sys.argv[3]
# copernicusmarine ≥2.x uses COPERNICUSMARINE_SERVICE_* names; support both
username=(os.getenv("COPERNICUSMARINE_SERVICE_USERNAME","") or os.getenv("COPERNICUS_MARINE_USERNAME","")).strip()
password=(os.getenv("COPERNICUSMARINE_SERVICE_PASSWORD","") or os.getenv("COPERNICUS_MARINE_PASSWORD","")).strip()
if not username or not password:
    out("PROVIDER_NOT_CONFIGURED", errorMessage="Copernicus Marine credentials are not configured.")

dataset=os.getenv("COPERNICUS_MARINE_DATASET","cmems_mod_glo_phy_my_0.083deg_P1D-m").strip()
target=os.path.join(tempfile.gettempdir(), f"aegis_marine_{os.getpid()}.nc")
try:
    result=copernicusmarine.subset(
        dataset_id=dataset,
        username=username,
        password=password,
        variables=["uo","vo"],
        minimum_longitude=lon,
        maximum_longitude=lon,
        minimum_latitude=lat,
        maximum_latitude=lat,
        minimum_depth=0.0,
        maximum_depth=1.0,
        start_datetime=timestamp,
        end_datetime=timestamp,
        output_filename=target,
        file_format="netcdf",
        coordinates_selection_method="nearest",
        disable_progress_bar=True,
    )
    file_path=getattr(result, "file_path", None) or target
    if not os.path.exists(file_path):
        out("DATA_UNAVAILABLE", errorMessage="Copernicus Marine returned no NetCDF file.")

    ds=xr.open_dataset(file_path)
    try:
        u=float(ds["uo"].squeeze().mean(skipna=True).item())
        v=float(ds["vo"].squeeze().mean(skipna=True).item())
    finally:
        ds.close()

    if not (math.isfinite(u) and math.isfinite(v)):
        out("DATA_UNAVAILABLE", errorMessage="Copernicus Marine returned non-finite current components.")

    speed_ms=(u*u+v*v)**0.5
    speed_knots=speed_ms*1.94384449244
    direction=(math.degrees(math.atan2(u,v))+360)%360

    print(json.dumps({
        "status":"SUCCESS",
        "provider":"Copernicus Marine Service",
        "dataset":dataset,
        "timestamp":timestamp,
        "latitude":lat,
        "longitude":lon,
        "u":u,
        "v":v,
        "speedKnots":speed_knots,
        "directionDeg":direction,
        "depthMeters":0.0,
        "resolution":"0.083 degree",
    }))
except Exception as exc:
    exc_type = type(exc).__name__
    msg = str(exc).strip() or exc_type
    # Authentication errors → PROVIDER_NOT_CONFIGURED so pipeline labels it correctly
    if exc_type in ("InvalidUsernameOrPassword", "CouldNotConnectToAuthenticationSystem"):
        out("PROVIDER_NOT_CONFIGURED",
            errorMessage="Copernicus Marine CAS authentication rejected credentials (invalid_grant: Invalid user credentials). "
                         "Verify COPERNICUS_MARINE_USERNAME and PASSWORD in server/.env are valid and active.")
    out("DATA_UNAVAILABLE", errorMessage=f"Copernicus Marine retrieval failed: {msg}")
finally:
    try: os.remove(target)
    except OSError: pass
