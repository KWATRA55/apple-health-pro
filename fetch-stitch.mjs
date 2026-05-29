import { writeFileSync, mkdirSync } from 'fs';

const API_KEY = process.env.STITCH_API_KEY || 'your-api-key-here';
const PROJECT_ID = '10650374066774271530';
const OUTDIR = '/Users/shashwat/Desktop/apple-health-ai/stitch-reference';

const SCREENS = [
    { id: 'a91743bd6b2e4c09b9b6a891047544f7', name: 'readiness-drilldown' },
    { id: '169b37d725194318baa45920d2bc3f9c', name: 'resilience-drilldown' },
    { id: 'e0396f6277044095b8d887a5d3827456', name: 'workout-analysis' },
    { id: '877eea811f2d42e298bba200ac124ca2', name: 'longevity-drilldown' },
    { id: 'ebc0bacfc0ee409c9a57d70291647c39', name: 'health-deep-dive' },
    { id: 'f8f33824d3dd4051aca66483b5b3d348', name: 'ai-health-assistant' },
    { id: 'd4f1ec71f383413087da28d845ff89d0', name: 'home-dashboard' },
    { id: '7f4cca9c8c884ed981495101df34263d', name: 'athlete-profile' },
    { id: 'bf8eef4b5d8f4f309b6917015cabd68b', name: 'edit-athlete-profile' },
    { id: '0c41dd6a6eff47d1bba979a6d2f76747', name: 'weekly-health-summary' },
    { id: 'a1262ee67d274cd3a1e2e1fa459663ea', name: 'monthly-health-report' },
];

mkdirSync(OUTDIR, { recursive: true });

for (const screen of SCREENS) {
    const apiUrl = `https://stitch.googleapis.com/v1/projects/${PROJECT_ID}/screens/${screen.id}?key=${API_KEY}`;

    try {
        console.log(`\nFetching: ${screen.name} (${screen.id})...`);

        // Fetch metadata
        const metaResp = await fetch(apiUrl);
        const meta = await metaResp.json();

        // Save full metadata JSON
        writeFileSync(`${OUTDIR}/${screen.name}.json`, JSON.stringify(meta, null, 2));
        console.log(`  ✓ Metadata saved (${JSON.stringify(meta).length} bytes)`);

        // Download HTML code
        if (meta.htmlCode?.downloadUrl) {
            const htmlResp = await fetch(meta.htmlCode.downloadUrl);
            const htmlText = await htmlResp.text();
            writeFileSync(`${OUTDIR}/${screen.name}.html`, htmlText);
            console.log(`  ✓ HTML saved (${htmlText.length} bytes)`);
        } else {
            console.log(`  ⚠ No HTML code URL found`);
        }

        // Download screenshot
        if (meta.screenshot?.downloadUrl) {
            const ssResp = await fetch(meta.screenshot.downloadUrl);
            const ssBuffer = await ssResp.arrayBuffer();
            writeFileSync(`${OUTDIR}/${screen.name}.png`, Buffer.from(ssBuffer));
            console.log(`  ✓ Screenshot saved (${ssBuffer.byteLength} bytes)`);
        } else {
            console.log(`  ⚠ No screenshot URL found`);
        }

    } catch (err) {
        console.error(`  ✗ Error: ${err.message}`);
    }
}

console.log('\n✅ All screens processed.');
