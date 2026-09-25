import { ORACLES } from '../src/core/knowledge/lore/data/LoreMasterData.js';


ORACLES.forEach((o, i) => {
    console.log(`\n=== [ORACLE ${i + 1}] ${o.id}: ${o.title} ===`);
    console.log(o.text);
    if (o.translatedText) console.log('JP: ' + o.translatedText.slice(0, 150) + '...');
});
