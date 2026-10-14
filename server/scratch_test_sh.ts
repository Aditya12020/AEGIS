import { config } from '../server/src/config/env';

async function main() {
  const tokenRes = await fetch('https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: config.copernicusDataSpace.clientId,
      client_secret: config.copernicusDataSpace.clientSecret,
    }),
  });
  const { access_token } = await tokenRes.json() as any;
  console.log('Token received:', Boolean(access_token));

  // Test Sentinel Hub Process API on sh.dataspace.copernicus.eu
  const processUrl = 'https://sh.dataspace.copernicus.eu/api/v1/process';
  const processBody = {
    input: {
      bounds: {
        bbox: [68.75, 21.65, 69.25, 22.05],
      },
      data: [
        {
          type: 'sentinel-1-grd',
          dataFilter: {
            timeRange: {
              from: '2026-08-01T00:00:00Z',
              to: '2026-09-05T00:00:00Z',
            },
          },
        },
      ],
    },
    output: {
      width: 256,
      height: 256,
      responses: [
        {
          identifier: 'default',
          format: {
            type: 'image/tiff',
          },
        },
      ],
    },
    evalscript: `//VERSION=3
function setup() {
  return {
    input: ["VV", "VH"],
    output: { bands: 3, sampleType: "FLOAT32" }
  };
}
function evaluatePixel(sample) {
  return [sample.VV, sample.VH, sample.VV > 0 && sample.VH > 0 ? sample.VH / sample.VV : 0];
}
`,
  };

  const pRes = await fetch(processUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${access_token}`,
      'Content-Type': 'application/json',
      Accept: 'image/tiff',
    },
    body: JSON.stringify(processBody),
  });

  console.log('Sentinel Hub Process API HTTP status:', pRes.status, pRes.headers.get('content-type'));
  if (pRes.ok) {
    const buf = await pRes.arrayBuffer();
    console.log('SUCCESS! Real Sentinel-1 3-band raster acquired! Size in bytes:', buf.byteLength);
  } else {
    const errText = await pRes.text();
    console.log('Error from Sentinel Hub:', errText);
  }
}

main().catch(console.error);
