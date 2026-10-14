# AEGIS ECMWF ERA5 Climate Data Store (CDS) Integration Guide

This guide documents the implementation, configuration, operation, and troubleshooting of the ECMWF ERA5 (Reanalysis v5) atmospheric reanalysis pipeline in AEGIS via the official Copernicus Climate Data Store (CDS) API.

---

## 1. Prerequisites & Official Sources

* **Official CDS API Documentation**: [https://cds.climate.copernicus.eu/how-to-api](https://cds.climate.copernicus.eu/how-to-api)
* **Official CDS API Endpoint**: `https://cds.climate.copernicus.eu/api`
* **Dataset Identifier**: `reanalysis-era5-single-levels`
* **Official Dataset Page & Terms**: [https://cds.climate.copernicus.eu/datasets/reanalysis-era5-single-levels](https://cds.climate.copernicus.eu/datasets/reanalysis-era5-single-levels)
* **Required Client**: `cdsapi >= 0.7.7` with `ecmwf-datastores-client >= 0.5.3` and `xarray >= 2024.1.0`.

---

## 2. CDS Account Registration & API Key Acquisition

1. Visit [https://cds.climate.copernicus.eu](https://cds.climate.copernicus.eu) and create or log in to your ECMWF/Copernicus account.
2. Once logged in, click your name in the top-right corner to open your **User Profile**.
3. Under the **API Token** section, copy your **Personal Access Token (PAT)**.
   * *Format*: An opaque UUID string (e.g., `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`).
   * *Note*: The new CDS infrastructure uses standalone tokens without the legacy `UID:` prefix.

---

## 3. Mandatory Step: Accepting Dataset Terms of Use

Before the CDS API will allow downloading ERA5 products, your Copernicus account must accept the dataset licence terms:

1. Open your browser and navigate to:
   [https://cds.climate.copernicus.eu/datasets/reanalysis-era5-single-levels?tab=download#manage-licences](https://cds.climate.copernicus.eu/datasets/reanalysis-era5-single-levels?tab=download#manage-licences)
2. Scroll to the bottom of the page to find the **Terms of use** section.
3. Click **Accept Terms**.
4. Once accepted, your API token is immediately authorized to request and download ERA5 NetCDF/GRIB data products.

> **Note on HTTP 403 / LICENCE_NOT_ACCEPTED**:
> If the terms have not been accepted, CDS returns an HTTP 403 with message:
> `required licences not accepted`. AEGIS automatically catches this condition, classifies it as `LICENCE_NOT_ACCEPTED`, and provides the direct URL in error responses.

---

## 4. Secure Credential Configuration

AEGIS supports two standard credential methods without hardcoding secrets:

### Method A: Environment Variable (`server/.env`) [Recommended for AEGIS]

In `c:\Users\LENOVO\Downloads\AEGIS\project\server\.env`:
```bash
# ECMWF ERA5 Climate Data Store Personal Access Token (PAT)
ERA5_API_KEY=YOUR_CDS_API_TOKEN_HERE

# Optional CDS API endpoint override (defaults to official URL)
ERA5_CDS_URL=https://cds.climate.copernicus.eu/api
```

### Method B: User Home Configuration File (`~/.cdsapirc`)

On **Windows**:
Path: `C:\Users\<USERNAME>\.cdsapirc`

On **Linux / macOS / Docker**:
Path: `~/.cdsapirc` or `$HOME/.cdsapirc`

File content:
```yaml
url: https://cds.climate.copernicus.eu/api
key: YOUR_CDS_API_TOKEN_HERE
```

> **Security Rules**:
> - Never commit `.cdsapirc` or `.env` to Git (both are excluded in `.gitignore`).
> - Never expose CDS tokens to the frontend browser bundle.
> - AEGIS exports tokens only to the child Python process memory via environment variables.

---

## 5. Architecture & Supported Climate Variables

### Selected Dataset
`reanalysis-era5-single-levels` (Atmospheric boundary layer single levels, $0.25^\circ \times 0.25^\circ$ resolution, hourly).

### Supported Climate Variables
| CDS API Variable Name | NetCDF Variable | Unit in NetCDF | Transformed Output Unit | Application Usage |
| :--- | :--- | :--- | :--- | :--- |
| `10m_u_component_of_wind` | `u10` | $\text{m}\cdot\text{s}^{-1}$ | $\text{m}\cdot\text{s}^{-1}$ | Eastward wind velocity for leeway drift forcing |
| `10m_v_component_of_wind` | `v10` | $\text{m}\cdot\text{s}^{-1}$ | $\text{m}\cdot\text{s}^{-1}$ | Northward wind velocity for leeway drift forcing |
| `2m_temperature` | `t2m` | $\text{Kelvin}$ | $\text{Celsius}$ ($T - 273.15$) | Evaporative oil weathering & surface viscosity |
| `surface_pressure` | `sp` | $\text{Pascal}$ | $\text{hPa}$ ($P / 100$) | Atmospheric pressure boundary |
| `total_precipitation` | `tp` | $\text{meters}$ | $\text{mm}$ ($P \times 1000$) | Sea-surface wave dampening & rain washdown |

### Derived Aerodynamic Variables
* **Wind Speed**: $\text{Speed}_{\text{ms}} = \sqrt{u_{10}^2 + v_{10}^2}$, converted to knots via factor $1.943844$.
* **Meteorological Wind Direction**: Angle where wind is blowing *from*:
  $$\theta_{\text{dir}} = \left(180 + \frac{180}{\pi} \operatorname{atan2}(u_{10}, v_{10})\right) \pmod{360}$$

---

## 6. Storage & Caching Architecture

Downloaded ERA5 NetCDF files are stored in:
`project/server/storage/era5/`

### Deterministic Filename Scheme
`era5_{dataset}_{YYYYMMDD_HH00}_{North}_{West}_{South}_{East}_{varHash}.nc`

Alongside each NetCDF file, a sidecar `.json` metadata file is saved with the extracted metrics and provenance.

### Cache Hit Workflow
Before querying the CDS API over the network, `Era5Service` checks if a valid, non-empty NetCDF matching the parameters already exists in `storage/era5/`. If found, it reads the local NetCDF in <5ms, sets `cached: true`, and returns immediately without consuming CDS quota or waiting in download queues.

---

## 7. Backend API Endpoints

The Express backend exposes the following REST endpoints under `/api/weather`:

| Method | Endpoint | Query / Body | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/weather/status` | — | Returns configuration status, credential detection, cached file counts, and terms URL. |
| `GET` | `/api/weather/era5/point` | `lat`, `lon`, `timestamp` | Synchronous point query returning wind vectors, temperature, pressure, and cache status. |
| `GET` | `/api/weather/era5/incident/:code` | Incident code or ID | Queries weather data for an incident's centroid and detection time. |
| `POST` | `/api/weather/era5/request` | `{ latitude, longitude, timestamp, async?: boolean }` | Submits an ERA5 retrieval request. If `async: true`, returns an immediate job ID (`job_era5_...`). |
| `GET` | `/api/weather/era5/jobs/:jobId` | Job ID | Polls the progress and final result of an asynchronous background retrieval job. |
| `GET` | `/api/weather/era5/files` | — | Lists cached NetCDF datasets with sizes, creation dates, and metadata. |

---

## 8. Frontend Integration

* **API Client**: `client/src/api/client.ts` exposes `api.weather.*` methods.
* **Origin & Drift Page**: `client/src/pages/OriginDriftPage.tsx` displays the **Copernicus Climate Data Store (CDS) · ECMWF ERA5 Reanalysis** atmospheric telemetry panel inside the Computation Details section, showcasing:
  - 10m U-Wind (eastward zonal component)
  - 10m V-Wind (northward meridional component)
  - 2m Air Temperature in Celsius
  - Surface Atmospheric Barometric Pressure in hPa
  - Cache status badge and local storage artifact path

---

## 9. Verification & Testing

### Running Python Unit & Integration Tests
```powershell
cd c:\Users\LENOVO\Downloads\AEGIS\project\server
python ml/test_era5.py
```
*Coverage*: 16 comprehensive tests verifying credentials detection, bounding box antimeridian wrapping, physical thermodynamic conversions, trigonometric wind vectors, NetCDF synthetic caching, and live CDS API connectivity.

### Running Backend API Route Integration Tests
```powershell
cd c:\Users\LENOVO\Downloads\AEGIS\project\server
npm run test:weather
```
*Coverage*: 7 automated endpoint tests verifying HTTP status codes, parameter validation, point retrieval, async job queues, and storage catalog queries.

### Type-Checking Server and Client
```powershell
# Server TypeScript check
cd c:\Users\LENOVO\Downloads\AEGIS\project\server
npx tsc --noEmit

# Client TypeScript check
cd c:\Users\LENOVO\Downloads\AEGIS\project\client
npx tsc --noEmit
```

---

## 10. Troubleshooting

| Symptom / Status | Root Cause | Solution |
| :--- | :--- | :--- |
| `PROVIDER_NOT_CONFIGURED` | `ERA5_API_KEY` is empty in `server/.env` and `~/.cdsapirc` is missing. | Add your token to `server/.env` (`ERA5_API_KEY=...`) or create `~/.cdsapirc`. |
| `LICENCE_NOT_ACCEPTED` | The account owner has not accepted the dataset Terms of Use on the CDS portal. | Visit [Manage Licences](https://cds.climate.copernicus.eu/datasets/reanalysis-era5-single-levels?tab=download#manage-licences) and click **Accept Terms**. |
| `AUTH_FAILED` | Token is invalid, expired, or revoked. | Log into CDS profile, regenerate your Personal Access Token, and update `server/.env`. |
| `DATA_UNAVAILABLE` | CDS queue timeout or coordinates out of range. | Check that latitude is between -90 and 90, longitude is between -180 and 180, and timestamp is valid ISO. |
| `Windows cp1252 Unicode Error` | Non-ASCII arrow symbols in console prints. | Resolved in `era5.py` and `test_era5.py` via UTF-8 standard console reconfiguration. |
