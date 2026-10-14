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

  const searchUrl = "https://catalogue.dataspace.copernicus.eu/odata/v1/Products?$filter=Collection/Name eq 'SENTINEL-1' and contains(Name,'GRD')&$top=1&$orderby=ContentDate/Start desc";
  const searchRes = await fetch(searchUrl, {
    headers: { Authorization: `Bearer ${access_token}` },
  });
  const searchJson = await searchRes.json() as any;
  const prod = searchJson.value[0];
  const safeName = prod.Name;

  const quickLookUrl = `https://download.dataspace.copernicus.eu/odata/v1/Products(${prod.Id})/Nodes(${safeName})/Nodes(preview)/Nodes(quick-look.png)/$value`;
  const qRes = await fetch(quickLookUrl, {
    headers: { Authorization: `Bearer ${access_token}` },
  });
  const text = await qRes.text();
  console.log('401 response body:', text);

  // Also test catalogue download endpoint
  const catUrl = `https://catalogue.dataspace.copernicus.eu/odata/v1/Products(${prod.Id})/$value`;
  const cRes = await fetch(catUrl, {
    headers: { Authorization: `Bearer ${access_token}` },
    redirect: 'manual',
  });
  console.log('catalogue $value status:', cRes.status, 'Location:', cRes.headers.get('location'));
}

main().catch(console.error);
