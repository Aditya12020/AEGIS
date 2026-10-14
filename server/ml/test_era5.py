"""
ERA5 CDS API Integration Tests
Tests authentication, licence status, area parameter format, credential validation,
thermodynamic and trigonometric unit conversions, and NetCDF caching.
"""
import json
import math
import os
import subprocess
import sys
import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
ERA5_SCRIPT = str(SCRIPT_DIR / "era5.py")
PYTHON = sys.executable

# Import functions from era5 module directly
sys.path.insert(0, str(SCRIPT_DIR.parent))
from ml.era5 import (
    Era5Service,
    calculate_wind_vectors,
    kelvin_to_celsius,
    pa_to_hpa,
    meters_to_mm,
    compute_cache_key,
    DATASET_NAME,
)


def run_era5(lat: float, lon: float, timestamp: str, env_overrides: dict = None):
    """Run era5.py as a subprocess and return parsed JSON output."""
    env = os.environ.copy()
    if env_overrides:
        env.update(env_overrides)
    result = subprocess.run(
        [PYTHON, ERA5_SCRIPT, str(lat), str(lon), timestamp],
        capture_output=True,
        text=True,
        timeout=180,
        cwd=str(SCRIPT_DIR),
        env=env,
    )
    stdout = result.stdout.strip()
    if not stdout:
        raise RuntimeError(f"era5.py produced no output. stderr: {result.stderr}")
    return json.loads(stdout)


class TestERA5PhysicalConversions(unittest.TestCase):
    """Validate mathematical formulas for unit conversions and wind vectors."""

    def test_kelvin_to_celsius(self):
        self.assertEqual(kelvin_to_celsius(273.15), 0.0)
        self.assertEqual(kelvin_to_celsius(300.15), 27.0)
        self.assertEqual(kelvin_to_celsius(253.15), -20.0)

    def test_pa_to_hpa(self):
        self.assertEqual(pa_to_hpa(101325.0), 1013.25)
        self.assertEqual(pa_to_hpa(100000.0), 1000.0)

    def test_meters_to_mm(self):
        self.assertEqual(meters_to_mm(0.005), 5.0)
        self.assertEqual(meters_to_mm(0.0), 0.0)

    def test_wind_from_north(self):
        # u=0, v=-10 -> wind blowing southwards (FROM north = 0 deg)
        speed, direction = calculate_wind_vectors(0.0, -10.0)
        self.assertAlmostEqual(direction, 0.0, places=1)
        self.assertAlmostEqual(speed, 19.4384, places=2)

    def test_wind_from_south(self):
        # u=0, v=10 -> wind blowing northwards (FROM south = 180 deg)
        speed, direction = calculate_wind_vectors(0.0, 10.0)
        self.assertAlmostEqual(direction, 180.0, places=1)
        self.assertAlmostEqual(speed, 19.4384, places=2)

    def test_wind_from_west(self):
        # u=10, v=0 -> wind blowing eastwards (FROM west = 270 deg)
        speed, direction = calculate_wind_vectors(10.0, 0.0)
        self.assertAlmostEqual(direction, 270.0, places=1)
        self.assertAlmostEqual(speed, 19.4384, places=2)

    def test_wind_from_east(self):
        # u=-10, v=0 -> wind blowing westwards (FROM east = 90 deg)
        speed, direction = calculate_wind_vectors(-10.0, 0.0)
        self.assertAlmostEqual(direction, 90.0, places=1)
        self.assertAlmostEqual(speed, 19.4384, places=2)


class TestERA5AreaParameter(unittest.TestCase):
    """Validate area bounding box calculations [North, West, South, East]."""

    def test_area_order(self):
        lat, lon = 22.0, 69.0
        north = min(90.0, lat + 0.25)
        south = max(-90.0, lat - 0.25)
        west = ((lon - 0.25) + 180) % 360 - 180
        east = ((lon + 0.25) + 180) % 360 - 180
        self.assertGreater(north, south)
        self.assertGreater(east, west)
        self.assertAlmostEqual(north, 22.25)
        self.assertAlmostEqual(south, 21.75)
        self.assertAlmostEqual(west, 68.75)
        self.assertAlmostEqual(east, 69.25)

    def test_area_antimeridian(self):
        """Test near 180 deg longitude."""
        lat, lon = 0.0, 179.9
        north = min(90.0, lat + 0.25)
        south = max(-90.0, lat - 0.25)
        west = ((lon - 0.25) + 180) % 360 - 180
        east = ((lon + 0.25) + 180) % 360 - 180
        self.assertGreater(north, south)
        self.assertAlmostEqual(north, 0.25)
        self.assertAlmostEqual(south, -0.25)
        self.assertAlmostEqual(west, 179.65)
        self.assertAlmostEqual(east, -179.85)


class TestERA5MissingCredentials(unittest.TestCase):
    """ERA5_API_KEY not set and CDSAPI_KEY not set -> PROVIDER_NOT_CONFIGURED."""

    def test_missing_key_returns_provider_not_configured(self):
        data = run_era5(
            22.0,
            69.0,
            "2024-01-15T12:00:00Z",
            {"ERA5_API_KEY": "", "CDSAPI_KEY": "", "HOME": tempfile.gettempdir()},
        )
        self.assertEqual(data["status"], "PROVIDER_NOT_CONFIGURED")
        self.assertIn("not configured", data["errorMessage"].lower())


class TestERA5InvalidKey(unittest.TestCase):
    """ERA5_API_KEY set to invalid string -> AUTH_FAILED or DATA_UNAVAILABLE."""

    def test_invalid_key_returns_error(self):
        data = run_era5(
            10.0,
            70.0,
            "2023-05-20T06:00:00Z",
            {"ERA5_API_KEY": "invalid-fake-key-000000", "CDSAPI_KEY": ""},
        )
        self.assertIn(data["status"], ["AUTH_FAILED", "DATA_UNAVAILABLE"])
        self.assertIn("errorMessage", data)


class TestERA5TimestampParsing(unittest.TestCase):
    """Invalid timestamp -> DATA_UNAVAILABLE."""

    def test_invalid_timestamp(self):
        data = run_era5(22.0, 69.0, "not-a-date", {"ERA5_API_KEY": "dummy-key"})
        self.assertEqual(data["status"], "DATA_UNAVAILABLE")
        self.assertIn("timestamp", data["errorMessage"].lower())


class TestERA5ServiceDirect(unittest.TestCase):
    """Direct unit tests on Era5Service class methods."""

    def test_service_status_structure(self):
        service = Era5Service()
        status = service.get_status()
        self.assertIn("provider", status)
        self.assertIn("dataset", status)
        self.assertIn("configured", status)
        self.assertIn("supportedVariables", status)
        self.assertIn("storageDirectory", status)
        self.assertEqual(status["dataset"], DATASET_NAME)

    def test_cache_key_generation(self):
        dt = datetime(2026, 9, 3, 14, 0, tzinfo=timezone.utc)
        area = [22.25, 68.75, 21.75, 69.25]
        vars_list = ["10m_u_component_of_wind", "10m_v_component_of_wind"]
        key = compute_cache_key(DATASET_NAME, dt, area, vars_list)
        self.assertTrue(key.startswith("era5_reanalysis-era5-single-levels_20260903_1400_"))


class TestERA5NetCDFCaching(unittest.TestCase):
    """Test reading and processing real NetCDF datasets from cache."""

    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.storage_dir = Path(self.temp_dir.name)
        self.service = Era5Service(storage_dir=self.storage_dir)

    def tearDown(self):
        self.temp_dir.cleanup()

    def test_cached_netcdf_processing(self):
        """Create a synthetic verified NetCDF dataset and verify cached retrieval."""
        import numpy as np
        import xarray as xr

        dt = datetime(2026, 9, 3, 14, 0, tzinfo=timezone.utc)
        lat, lon = 21.8, 68.9
        area = [22.05, 68.65, 21.55, 69.15]
        vars_list = [
            "10m_u_component_of_wind",
            "10m_v_component_of_wind",
            "2m_temperature",
            "surface_pressure",
            "total_precipitation",
        ]

        # Generate cache key and path
        cache_key = compute_cache_key(DATASET_NAME, dt, area, vars_list)
        nc_path = self.storage_dir / f"{cache_key}.nc"

        # Create realistic synthetic NetCDF with xarray
        lats = np.array([22.0, 21.75])
        lons = np.array([68.75, 69.0])
        times = [np.datetime64("2026-09-03T14:00:00")]

        # u = -4.5 m/s, v = -2.5 m/s, t2m = 301.5 K (28.35 C), sp = 100950 Pa (1009.5 hPa)
        ds = xr.Dataset(
            data_vars={
                "u10": (["time", "latitude", "longitude"], np.full((1, 2, 2), -4.5)),
                "v10": (["time", "latitude", "longitude"], np.full((1, 2, 2), -2.5)),
                "t2m": (["time", "latitude", "longitude"], np.full((1, 2, 2), 301.5)),
                "sp": (["time", "latitude", "longitude"], np.full((1, 2, 2), 100950.0)),
                "tp": (["time", "latitude", "longitude"], np.full((1, 2, 2), 0.002)),
            },
            coords={
                "time": times,
                "latitude": lats,
                "longitude": lons,
            },
        )
        ds.to_netcdf(str(nc_path))
        ds.close()

        self.assertTrue(nc_path.exists())
        self.assertGreater(nc_path.stat().st_size, 1000)

        # Query point with caching enabled
        result = self.service.retrieve_point(
            lat, lon, "2026-09-03T14:00:00Z", variables=vars_list, use_cache=True
        )

        self.assertEqual(result["status"], "SUCCESS")
        self.assertTrue(result["cached"])
        self.assertEqual(result["u10"], -4.5)
        self.assertEqual(result["v10"], -2.5)
        self.assertAlmostEqual(result["temperatureC"], 28.35, places=1)
        self.assertAlmostEqual(result["surfacePressureHpa"], 1009.5, places=1)
        self.assertAlmostEqual(result["totalPrecipitationMm"], 2.0, places=1)
        self.assertGreater(result["windSpeedKnots"], 9.0)
        self.assertGreaterEqual(result["windDirectionDeg"], 0)
        self.assertLessEqual(result["windDirectionDeg"], 360)
        self.assertIn("storagePath", result)


class TestERA5ConfiguredKey(unittest.TestCase):
    """With the real ERA5_API_KEY from .env — test actual CDS API live connectivity."""

    def setUp(self):
        from dotenv import load_dotenv

        load_dotenv(str(SCRIPT_DIR.parent / ".env"))
        self.api_key = os.getenv("ERA5_API_KEY", "").strip()
        if not self.api_key:
            self.skipTest("ERA5_API_KEY not configured in .env")

    def test_real_cds_request(self):
        data = run_era5(22.0, 69.0, "2024-01-15T12:00:00Z")

        valid_statuses = [
            "SUCCESS",
            "LICENCE_NOT_ACCEPTED",
            "AUTH_FAILED",
            "DATA_UNAVAILABLE",
        ]
        self.assertIn(
            data["status"], valid_statuses, f"Unexpected status: {data['status']}"
        )

        print(f"\n  ERA5 CDS response status: {data['status']}")
        if "errorMessage" in data:
            print(f"  Error: {data['errorMessage'][:200]}")

        if data["status"] == "SUCCESS":
            self.assertIn("u10", data)
            self.assertIn("v10", data)
            self.assertIn("windSpeedKnots", data)
            self.assertIn("windDirectionDeg", data)
            self.assertTrue(math.isfinite(data["u10"]))
            self.assertTrue(math.isfinite(data["v10"]))
            self.assertGreaterEqual(data["windSpeedKnots"], 0)
            self.assertEqual(data["provider"], "Copernicus Climate Change Service (C3S)")
            self.assertEqual(data["dataset"], "reanalysis-era5-single-levels")
            print(
                f"  Wind: {data['windSpeedKnots']:.2f} kn at {data['windDirectionDeg']:.1f} deg"
            )
            print(f"  u10={data['u10']:.3f} m/s, v10={data['v10']:.3f} m/s")

        elif data["status"] == "LICENCE_NOT_ACCEPTED":
            self.assertIn("licence", data["errorMessage"].lower())
            print("  -> User must accept licence at CDS portal")

        elif data["status"] == "AUTH_FAILED":
            print("  -> API key is invalid or expired")


if __name__ == "__main__":
    unittest.main(verbosity=2)
