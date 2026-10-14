# AEGIS implementation status

## Supplied U-Net checkpoint

- Checkpoint: `server/ml/weights/unet_oilspill.pth`
- SHA-256: `742ce020931cae4b8551159b82b7c9268203da029a6d94bd1d1a97b57cd268fc`
- Reconstructed architecture: U-Net with ResNet-34 encoder
- Checkpoint input channels: 3
- Checkpoint output channels: 1
- Training image size: NOT STORED IN CHECKPOINT
- Training representation: NOT STORED IN CHECKPOINT
- Training normalization: NOT STORED IN CHECKPOINT
- Production compatibility: `MODEL COMPATIBILITY UNVERIFIED`

The ML service refuses synthetic SAR input and refuses production inference by default until
`AEGIS_UNET_COMPATIBILITY_VERIFIED=true` is deliberately enabled after the training
representation/preprocessing has been independently verified.

## Provider behavior

- Copernicus Data Space: server-side OAuth + AOI/time-bounded Sentinel-1 GRD search + authenticated product download.
- ERA5: server-side CDS API integration using `ERA5_API_KEY`.
- Copernicus Marine: server-side Toolbox integration using the configured dataset and incident coordinate/time.
- Missing credentials produce `PROVIDER NOT CONFIGURED`.
- Provider/network/data failures produce `DATA UNAVAILABLE`.
- No demo Sentinel-1 scene is substituted for a failed real acquisition.
- No synthetic SAR is generated for U-Net inference.

## Validation performed

- U-Net checkpoint architecture/state_dict load: PASS
- U-Net self-test: PASS
- Synthetic SAR fallback rejection: PASS
- Compatibility gate: PASS
- Server TypeScript build: PASS
- Client TypeScript check: PASS
- Client production Vite build: not executed successfully in the supplied environment because the bundled Linux Rollup optional dependency is missing.

## Remaining blockers

1. Configure actual Copernicus Data Space credentials.
2. Configure ERA5 CDS personal access token and accept the ERA5 dataset terms.
3. Configure Copernicus Marine credentials and verify the selected dataset covers the investigation timestamp.
4. Verify the supplied U-Net's training data representation, channel semantics, normalization, threshold, and training tile size from the original training pipeline.
5. Only after (4), set `AEGIS_UNET_COMPATIBILITY_VERIFIED=true` and complete a real Sentinel-1 raster-to-model adapter.
6. Run one complete real-data E2E investigation and record each stage as PASS/FAIL/BLOCKED/PROVIDER NOT CONFIGURED/DATA UNAVAILABLE.
