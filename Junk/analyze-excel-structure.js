const XLSX = require('xlsx');
const fs = require('fs');

// Read the Excel file
const workbook = XLSX.readFile('Salaried Individuals 2025.xlsx');

console.log('=== EXCEL FILE ANALYSIS ===\n');

// Get all sheet names
const sheetNames = workbook.SheetNames;
console.log('Sheet Names:', sheetNames);
console.log('\n');

// Analyze each sheet
sheetNames.forEach((sheetName, index) => {
    console.log(`=== SHEET ${index + 1}: ${sheetName} ===`);

    const worksheet = workbook.Sheets[sheetName];

    // Get the range of the worksheet
    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1:A1');
    console.log(`Range: ${worksheet['!ref'] || 'Empty'}`);

    // Extract all cells with formulas and values
    const cellsData = {};
    const formulaCells = [];

    for (let R = range.s.r; R <= range.e.r; ++R) {
        for (let C = range.s.c; C <= range.e.c; ++C) {
            const cellAddress = XLSX.utils.encode_cell({c: C, r: R});
            const cell = worksheet[cellAddress];

            if (cell) {
                cellsData[cellAddress] = {
                    value: cell.v,
                    formula: cell.f,
                    type: cell.t
                };

                // If cell has a formula, add to formula cells
                if (cell.f) {
                    formulaCells.push({
                        address: cellAddress,
                        formula: cell.f,
                        value: cell.v,
                        type: cell.t
                    });
                }
            }
        }
    }

    console.log(`Total cells with data: ${Object.keys(cellsData).length}`);
    console.log(`Cells with formulas: ${formulaCells.length}`);

    // Show first few rows to understand structure
    console.log('\n--- First 20 rows with data ---');
    for (let R = range.s.r; R <= Math.min(range.e.r, range.s.r + 19); ++R) {
        const rowData = [];
        let hasData = false;

        for (let C = range.s.c; C <= Math.min(range.e.c, range.s.c + 10); ++C) {
            const cellAddress = XLSX.utils.encode_cell({c: C, r: R});
            const cell = worksheet[cellAddress];

            if (cell) {
                rowData.push(cell.v || '');
                hasData = true;
            } else {
                rowData.push('');
            }
        }

        if (hasData) {
            console.log(`Row ${R + 1}: ${rowData.join(' | ')}`);
        }
    }

    // Show formulas if any
    if (formulaCells.length > 0) {
        console.log('\n--- FORMULAS ---');
        formulaCells.slice(0, 20).forEach(cell => {
            console.log(`${cell.address}: ${cell.formula} = ${cell.value}`);
        });

        if (formulaCells.length > 20) {
            console.log(`... and ${formulaCells.length - 20} more formulas`);
        }
    }

    console.log('\n' + '='.repeat(50) + '\n');
});

// Save detailed analysis to JSON file
const analysisData = {
    sheetNames,
    sheets: {}
};

sheetNames.forEach(sheetName => {
    const worksheet = workbook.Sheets[sheetName];
    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1:A1');

    analysisData.sheets[sheetName] = {
        range: worksheet['!ref'],
        cells: {},
        formulas: [],
        structure: []
    };

    // Extract all cell data
    for (let R = range.s.r; R <= range.e.r; ++R) {
        for (let C = range.s.c; C <= range.e.c; ++C) {
            const cellAddress = XLSX.utils.encode_cell({c: C, r: R});
            const cell = worksheet[cellAddress];

            if (cell) {
                analysisData.sheets[sheetName].cells[cellAddress] = {
                    value: cell.v,
                    formula: cell.f,
                    type: cell.t
                };

                if (cell.f) {
                    analysisData.sheets[sheetName].formulas.push({
                        address: cellAddress,
                        formula: cell.f,
                        value: cell.v
                    });
                }
            }
        }
    }

    // Create structure analysis (first 20 rows)
    for (let R = range.s.r; R <= Math.min(range.e.r, range.s.r + 19); ++R) {
        const rowData = {};
        let hasData = false;

        for (let C = range.s.c; C <= range.e.c; ++C) {
            const cellAddress = XLSX.utils.encode_cell({c: C, r: R});
            const cell = worksheet[cellAddress];

            if (cell) {
                rowData[cellAddress] = cell.v;
                hasData = true;
            }
        }

        if (hasData) {
            analysisData.sheets[sheetName].structure.push({
                row: R + 1,
                data: rowData
            });
        }
    }
});

// Save to JSON file
fs.writeFileSync('excel-analysis.json', JSON.stringify(analysisData, null, 2));
console.log('Detailed analysis saved to excel-analysis.json');