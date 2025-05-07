// Script to update the baseline URLs in urls-final.json based on urls.json
// Used when similar pages are identified.

const fs = require('fs');
const path = require('path');

// Read both JSON files
const urlsFullPath = path.join('fixtures', 'urls-final.json');
const urlsPath = path.join('fixtures', 'urls.json');

const urlsFull = JSON.parse(fs.readFileSync(urlsFullPath, 'utf8'));
const urls = JSON.parse(fs.readFileSync(urlsPath, 'utf8'));

// Create a map of comparison paths to baseline paths from urls.json
const baselineMap = urls.reduce((map, item) => {
    map[item.comparison] = item.baseline;
    return map;
}, {});

// Update baselines in urls-full.json where comparison paths match
const updatedUrlsFull = urlsFull.map(item => {
    if (baselineMap[item.comparison]) {
        return {
            ...item,
            baseline: baselineMap[item.comparison]
        };
    }
    return item;
});

// Write the updated data back to urls-full.json
fs.writeFileSync(urlsFullPath, JSON.stringify(updatedUrlsFull, null, 2));
