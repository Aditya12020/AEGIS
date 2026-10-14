"""
AEGIS ERA5 MetOcean Reanalysis Integration Service
ECMWF ERA5 Single Levels via Copernicus Climate Data Store (CDS) API

Provides atmospheric reanalysis forcing for Lagrangian oil spill drift modeling,
spill origin backtracking, and maritime forensic evidence dossiers.
"""

import hashlib
import json
import math
import os
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

# Ensure stdout handles UTF-8 on Windows
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

# Load environment configuration from server/.env
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv()
load_dotenv(BASE_DIR / ".env")

# Default storage location for downloaded ERA5 NetCDF products
DEFAULT_STORAGE_DIR = BASE_DIR / "storage" / "era5"
DATASET_NAME = "reanalysis-era5-single-levels"
DEFAULT_CDS_URL = "https://cds.climate.copernicus.eu/api"

# Default variables for maritime forensic drift & weathering
DEFAULT_VARIABLES = [
    "10m_u_component_of_wind",
    "10m_v_component_of_wind",
    "2m_temperature",
    "surface_pressure",
    "total_precipitation",
]


def get_cds_credentials() -> Tuple[Optional[str], str, str]:
    """
    Resolve CDS API credentials securely without exposing secrets.
    Checks environment variables (ERA5_API_KEY, CDSAPI_KEY) and $HOME/.cdsapirc.
    Returns: (token_or_none, cds_url, source_description)
    """
    cds_url = os.getenv("ERA5_CDS_URL") or os.getenv("CDSAPI_URL") or DEFAULT_CDS_URL
    cds_url = cds_url.strip()

    # 1. Environment variable: ERA5_API_KEY or CDSAPI_KEY
    env_token = (os.getenv("ERA5_API_KEY") or os.getenv("CDSAPI_KEY") or "").strip()
    if env_token:
        # Export for ecmwf-datastores-client / cdsapi subprocesses
        os.environ["CDSAPI_URL"] = cds_url
        os.environ["CDSAPI_KEY"] = env_token
        return env_token, cds_url, "environment variable"

    # 2. $HOME/.cdsapirc file
    home_dir = Path.home()
    cdsapirc_path = home_dir / ".cdsapirc"
    if cdsapirc_path.is_file():
        try:
            with open(cdsapirc_path, "r", encoding="utf-8") as f:
                content = f.read()
            token = ""
            url = cds_url
            for line in content.splitlines():
                line = line.strip()
                if line.startswith("key:"):
                    token = line.split(":", 1)[1].strip()
                elif line.startswith("url:"):
                    url = line.split(":", 1)[1].strip()
            if token:
                os.environ["CDSAPI_URL"] = url
                os.environ["CDSAPI_KEY"] = token
                return token, url, f"configuration file ({cdsapirc_path.name})"
        except Exception:
            pass

    return None, cds_url, "none"


def ensure_storage_dir(custom_dir: Optional[Path] = None) -> Path:
    """Ensure that the local ERA5 product storage directory exists."""
    storage_dir = custom_dir or DEFAULT_STORAGE_DIR
    storage_dir.mkdir(parents=True, exist_ok=True)
    return storage_dir


def compute_cache_key(
    dataset: str,
    dt: datetime,
    area: List[float],
    variables: List[str],
) -> str:
    """Generate a deterministic filename for caching downloaded NetCDF files."""
    area_str = "_".join(f"{v:.2f}" for v in area)
    var_hash = hashlib.sha256(",".join(sorted(variables)).encode()).hexdigest()[:8]
    date_str = dt.strftime("%Y%m%d_%H00")
    return f"era5_{dataset}_{date_str}_{area_str}_{var_hash}"


def calculate_wind_vectors(u: float, v: float) -> Tuple[float, float]:
    """
    Calculate wind speed (knots) and meteorological wind direction (degrees).
    u: eastward wind velocity (m/s)
    v: northward wind velocity (m/s)
    Wind direction is the direction the wind is blowing FROM (0° = North, 90° = East).
    """
    speed_ms = math.sqrt(u * u + v * v)
    speed_knots = speed_ms * 1.94384449244
    direction_deg = (math.degrees(math.atan2(-u, -v)) + 360.0) % 360.0
    return speed_knots, direction_deg


def kelvin_to_celsius(k: float) -> float:
    """Explicit thermodynamic conversion from Kelvin to Celsius."""
    return round(k - 273.15, 2)


def pa_to_hpa(pa: float) -> float:
    """Convert Pascal to hectopascal (millibar)."""
    return round(pa / 100.0, 2)


def meters_to_mm(m: float) -> float:
    """Convert precipitation meters to millimeters."""
    return round(m * 1000.0, 2)


class Era5Service:
    """Reusable service layer for ECMWF ERA5 Climate Data Store requests."""

    def __init__(self, storage_dir: Optional[Path] = None):
        self.storage_dir = ensure_storage_dir(storage_dir)
        self.token, self.cds_url, self.cred_source = get_cds_credentials()

    def get_status(self) -> Dict[str, Any]:
        """Check ERA5 provider configuration, credential status, and storage."""
        cached_files = list(self.storage_dir.glob("*.nc"))
        total_bytes = sum(f.stat().st_size for f in cached_files) if cached_files else 0

        status: Dict[str, Any] = {
            "provider": "Copernicus Climate Change Service (C3S) - ECMWF ERA5",
            "dataset": DATASET_NAME,
            "configured": bool(self.token),
            "credentialSource": self.cred_source,
            "cdsUrl": self.cds_url,
            "storageDirectory": str(self.storage_dir),
            "cachedFilesCount": len(cached_files),
            "cachedStorageBytes": total_bytes,
            "supportedVariables": DEFAULT_VARIABLES,
        }

        if not self.token:
            status["status"] = "PROVIDER_NOT_CONFIGURED"
            status["errorMessage"] = (
                "ERA5 API key is not configured. Add ERA5_API_KEY to server/.env or configure ~/.cdsapirc."
            )
        else:
            status["status"] = "CONFIGURED"

        return status

    def retrieve_point(
        self,
        lat: float,
        lon: float,
        timestamp_iso: str,
        variables: Optional[List[str]] = None,
        use_cache: bool = True,
    ) -> Dict[str, Any]:
        """
        Retrieve ERA5 reanalysis data for a specific geographic coordinate and timestamp.
        """
        # Input coordinate validation
        if not (-90.0 <= lat <= 90.0):
            return {
                "status": "DATA_UNAVAILABLE",
                "errorMessage": f"Latitude {lat} out of bounds (-90 to +90).",
            }
        if not (-180.0 <= lon <= 180.0):
            return {
                "status": "DATA_UNAVAILABLE",
                "errorMessage": f"Longitude {lon} out of bounds (-180 to +180).",
            }

        # Timestamp validation
        try:
            dt = datetime.fromisoformat(timestamp_iso.replace("Z", "+00:00")).astimezone(timezone.utc)
        except Exception as exc:
            return {
                "status": "DATA_UNAVAILABLE",
                "errorMessage": f"Invalid ISO timestamp '{timestamp_iso}': {exc}",
            }

        # Compute bounding area around coordinate [North, West, South, East]
        north = min(90.0, round(lat + 0.25, 4))
        south = max(-90.0, round(lat - 0.25, 4))
        west = round(((lon - 0.25) + 180) % 360 - 180, 4)
        east = round(((lon + 0.25) + 180) % 360 - 180, 4)
        area = [north, west, south, east]

        vars_to_request = variables or DEFAULT_VARIABLES

        # Check credentials
        if not self.token:
            return {
                "status": "PROVIDER_NOT_CONFIGURED",
                "errorMessage": (
                    "ERA5_API_KEY is not configured in server/.env and ~/.cdsapirc is missing."
                ),
            }

        # Check local cache first
        cache_key = compute_cache_key(DATASET_NAME, dt, area, vars_to_request)
        target_nc = self.storage_dir / f"{cache_key}.nc"
        target_meta = self.storage_dir / f"{cache_key}.json"

        if use_cache and target_nc.is_file() and target_nc.stat().st_size > 1000:
            try:
                result = self._process_netcdf(target_nc, lat, lon, dt, area, vars_to_request)
                result["cached"] = True
                result["storagePath"] = str(target_nc)
                return result
            except Exception:
                # If cached file was corrupted, proceed to redownload
                pass

        # Perform CDS API retrieval
        retrieval_result = self._download_from_cds(dt, area, vars_to_request, target_nc)
        if retrieval_result.get("status") != "SUCCESS":
            return retrieval_result

        # Process downloaded NetCDF
        try:
            result = self._process_netcdf(target_nc, lat, lon, dt, area, vars_to_request)
            result["cached"] = False
            result["storagePath"] = str(target_nc)

            # Save sidecar metadata JSON
            try:
                with open(target_meta, "w", encoding="utf-8") as f:
                    json.dump(result, f, indent=2)
            except Exception:
                pass

            return result
        except Exception as exc:
            return {
                "status": "DATA_UNAVAILABLE",
                "errorMessage": f"Failed to process downloaded NetCDF dataset: {exc}",
            }

    def _download_from_cds(
        self,
        dt: datetime,
        area: List[float],
        variables: List[str],
        target_file: Path,
    ) -> Dict[str, Any]:
        """Submit retrieve request to Copernicus Climate Data Store."""
        try:
            import cdsapi
        except ImportError as exc:
            return {
                "status": "DATA_UNAVAILABLE",
                "errorMessage": f"Python cdsapi client is not installed: {exc}",
            }

        request = {
            "product_type": ["reanalysis"],
            "variable": variables,
            "year": [dt.strftime("%Y")],
            "month": [dt.strftime("%m")],
            "day": [dt.strftime("%d")],
            "time": [dt.strftime("%H:00")],
            "area": area,
            "data_format": "netcdf",
            "download_format": "unarchived",
        }

        temp_target = target_file.with_suffix(".part")

        try:
            client = cdsapi.Client(
                url=self.cds_url,
                key=self.token,
                quiet=True,
                progress=False,
            )

            client.retrieve(DATASET_NAME, request, str(temp_target))

            if not temp_target.exists() or temp_target.stat().st_size < 1000:
                if temp_target.exists():
                    temp_target.unlink()
                return {
                    "status": "DATA_UNAVAILABLE",
                    "errorMessage": "CDS request returned an empty or unreadable file.",
                }

            # Safely move verified file to final cache target
            if target_file.exists():
                target_file.unlink()
            temp_target.rename(target_file)

            return {"status": "SUCCESS"}

        except Exception as exc:
            if temp_target.exists():
                try:
                    temp_target.unlink()
                except OSError:
                    pass

            msg = str(exc).strip() or exc.__class__.__name__
            msg_lower = msg.lower()

            if "required licences not accepted" in msg_lower or "licence" in msg_lower:
                return {
                    "status": "LICENCE_NOT_ACCEPTED",
                    "errorMessage": (
                        "ERA5 licence terms have not been accepted. "
                        "Visit https://cds.climate.copernicus.eu/datasets/reanalysis-era5-single-levels"
                        "?tab=download#manage-licences to accept the required licence(s). "
                        f"Original error: {msg}"
                    ),
                }
            elif "401" in msg or "unauthorized" in msg_lower:
                return {
                    "status": "AUTH_FAILED",
                    "errorMessage": (
                        "ERA5 authentication failed — the configured API key may be invalid or expired. "
                        f"Original error: {msg}"
                    ),
                }
            elif "403" in msg and "licence" not in msg_lower:
                return {
                    "status": "AUTH_FAILED",
                    "errorMessage": (
                        "ERA5 access denied (403). The API key may lack permissions. "
                        f"Original error: {msg}"
                    ),
                }
            else:
                return {
                    "status": "DATA_UNAVAILABLE",
                    "errorMessage": f"ERA5 CDS retrieval failed: {msg}",
                }

    def _process_netcdf(
        self,
        nc_path: Path,
        lat: float,
        lon: float,
        dt: datetime,
        area: List[float],
        variables: List[str],
    ) -> Dict[str, Any]:
        """Read and validate variables from NetCDF file via xarray."""
        import zipfile

        try:
            import xarray as xr
        except ImportError as exc:
            raise RuntimeError(f"xarray is required for climate data extraction: {exc}")

        # Check if CDS returned a multi-stream ZIP archive (e.g. instant + accum streams)
        if zipfile.is_zipfile(str(nc_path)):
            with tempfile.TemporaryDirectory() as td:
                with zipfile.ZipFile(str(nc_path), "r") as z:
                    z.extractall(td)
                    extracted_names = [fname for fname in z.namelist() if fname.endswith(".nc")]

                if not extracted_names:
                    raise ValueError("Downloaded ZIP archive contains no NetCDF (.nc) files.")

                extracted_ncs = [Path(td) / fname for fname in extracted_names]
                opened_ds = [xr.open_dataset(str(p)) for p in extracted_ncs]
                try:
                    merged_ds = xr.merge(opened_ds, compat="override")
                    # Overwrite zip with clean consolidated NetCDF file (zip file is now closed)
                    if nc_path.exists():
                        nc_path.unlink()
                    merged_ds.to_netcdf(str(nc_path))
                finally:
                    for d in opened_ds:
                        d.close()

        ds = xr.open_dataset(str(nc_path))
        try:
            # Check wind vectors
            if "u10" not in ds or "v10" not in ds:
                raise ValueError("Downloaded NetCDF does not contain u10 and v10 wind variables.")

            u = float(ds["u10"].mean(skipna=True).item())
            v = float(ds["v10"].mean(skipna=True).item())

            if not (math.isfinite(u) and math.isfinite(v)):
                raise ValueError("NetCDF contains non-finite values for wind components.")

            speed_knots, direction_deg = calculate_wind_vectors(u, v)

            result: Dict[str, Any] = {
                "status": "SUCCESS",
                "provider": "Copernicus Climate Change Service (C3S)",
                "dataset": DATASET_NAME,
                "timestamp": dt.strftime("%Y-%m-%dT%H:%M:%SZ"),
                "latitude": lat,
                "longitude": lon,
                "area_requested": {
                    "north": area[0],
                    "west": area[1],
                    "south": area[2],
                    "east": area[3],
                },
                "variables": variables,
                "u10": round(u, 3),
                "v10": round(v, 3),
                "windSpeedKnots": round(speed_knots, 2),
                "windSpeedMs": round(math.sqrt(u * u + v * v), 2),
                "windDirectionDeg": round(direction_deg, 1),
                "units": {
                    "u10": "m s-1",
                    "v10": "m s-1",
                    "windSpeedKnots": "knots",
                    "windSpeedMs": "m s-1",
                    "windDirectionDeg": "degrees",
                },
            }

            # Optional thermodynamic and atmospheric variables
            if "t2m" in ds:
                t2m_k = float(ds["t2m"].mean(skipna=True).item())
                if math.isfinite(t2m_k):
                    result["temperatureC"] = kelvin_to_celsius(t2m_k)
                    result["units"]["temperatureC"] = "celsius"

            if "sp" in ds:
                sp_pa = float(ds["sp"].mean(skipna=True).item())
                if math.isfinite(sp_pa):
                    result["surfacePressureHpa"] = pa_to_hpa(sp_pa)
                    result["units"]["surfacePressureHpa"] = "hPa"

            if "tp" in ds:
                tp_m = float(ds["tp"].mean(skipna=True).item())
                if math.isfinite(tp_m):
                    result["totalPrecipitationMm"] = meters_to_mm(tp_m)
                    result["units"]["totalPrecipitationMm"] = "mm"

            return result
        finally:
            ds.close()


def main():
    """Command-line entry point for ERA5 queries."""
    service = Era5Service()

    if len(sys.argv) == 2 and sys.argv[1] in ("--status", "status"):
        status_info = service.get_status()
        print(json.dumps(status_info, indent=2))
        return

    if len(sys.argv) == 4:
        # Standard format: python era5.py <lat> <lon> <timestamp>
        try:
            lat = float(sys.argv[1])
            lon = float(sys.argv[2])
            timestamp = sys.argv[3]
        except ValueError as exc:
            print(json.dumps({
                "status": "DATA_UNAVAILABLE",
                "errorMessage": f"Invalid command line arguments: {exc}",
            }))
            return

        result = service.retrieve_point(lat, lon, timestamp)
        print(json.dumps(result))
        return

    if len(sys.argv) == 6 and sys.argv[1] in ("--bbox", "bbox"):
        # Format: python era5.py --bbox <north> <west> <south> <east> <timestamp>
        try:
            north = float(sys.argv[2])
            west = float(sys.argv[3])
            south = float(sys.argv[4])
            east = float(sys.argv[5])
            timestamp = sys.argv[6] if len(sys.argv) > 6 else datetime.now(timezone.utc).isoformat()
        except ValueError as exc:
            print(json.dumps({
                "status": "DATA_UNAVAILABLE",
                "errorMessage": f"Invalid bbox arguments: {exc}",
            }))
            return

        center_lat = (north + south) / 2.0
        center_lon = (west + east) / 2.0
        result = service.retrieve_point(center_lat, center_lon, timestamp)
        print(json.dumps(result))
        return

    # Help message
    print(json.dumps({
        "status": "DATA_UNAVAILABLE",
        "errorMessage": (
            "Usage: python era5.py <latitude> <longitude> <timestamp>\n"
            "   or: python era5.py --status\n"
            "   or: python era5.py --bbox <north> <west> <south> <east> <timestamp>"
        ),
    }))


if __name__ == "__main__":
    main()
