import ExcelJS from 'exceljs';
import path from 'node:path';

const excelPath = path.join(
  process.cwd(),
  '医院',
  '华山医院',
  '华山医院_详细医生信息.xlsx',
);

const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(excelPath);
const ws = wb.worksheets[0];

console.log('Row 1 (Headers):');
ws.getRow(1).eachCell((cell, colNumber) => {
  console.log(`  Col ${colNumber}: ${cell.value}`);
});

console.log('\nRow 2 (Headers):');
ws.getRow(2).eachCell((cell, colNumber) => {
  console.log(`  Col ${colNumber}: ${cell.value}`);
});

console.log('\nRow 3 (First data row):');
ws.getRow(3).eachCell((cell, colNumber) => {
  const val = String(cell.value || '');
  console.log(`  Col ${colNumber}: [${val.length} chars] ${val.substring(0, 80)}`);
});
