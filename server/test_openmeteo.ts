import { OpenMeteoOceanProvider, OpenMeteoWeatherProvider } from './src/providers';

async function test() {
  console.log('Testing OpenMeteo ocean...');
  const op = new OpenMeteoOceanProvider();
  const o = await op.getCurrent(21.8033, 68.9083, '2026-09-03T14:20:18.000Z');
  console.log('Ocean:', o.status, o.currentSpeedKnots, o.currentDirectionDeg, o.provenanceLabel);

  console.log('Testing OpenMeteo weather...');
  const wp = new OpenMeteoWeatherProvider();
  const w = await wp.getWind(21.8033, 68.9083, '2026-09-03T14:20:18.000Z');
  console.log('Weather:', w.status, w.windSpeedKnots, w.windDirectionDeg, w.provenanceLabel);
  process.exit(0);
}

test();
