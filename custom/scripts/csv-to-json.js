const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse');

const processFile = async (inputFile) => {
    try {
        const records = [];
        let id = 1;
        console.log('Starting CSV processing...');
        console.log(`Reading from: ${inputFile}`);

        const parser = fs
            .createReadStream(inputFile)
            .pipe(parse({
                columns: true,
                skip_empty_lines: true,
                bom: true  // Handle BOM character
            }));

        for await (const record of parser) {
            record.id = id++;
            record.device = "desktop";
            record.width = 1000;
            record.height = 800;

            // Remove leading slash if present
            record.baseline = record.baseline?.replace(/^\//, '');
            record.comparison = record.comparison?.replace(/^\//, '');
            
            // Clean any potential BOM from comparison field
            if (record.comparison && record.comparison.charCodeAt(0) === 65279) {
                record.comparison = record.comparison.slice(1);
            }

            records.push(record);
        }

        const outputPath = path.join('fixtures', 'urls.json');
        fs.writeFileSync(outputPath, JSON.stringify(records, null, 2));
        console.log(`Found ${records.length} records`);
        console.log(`Successfully wrote to ${outputPath}`);

    } catch (error) {
        console.error('Error processing file:');
        console.error(error);
    }
};

// Execute the function when script is run
const inputFile = process.argv[2];
if (!inputFile) {
    console.log('Please provide an input file path');
    process.exit(1);
}

processFile(inputFile);
