import readXlsxFile from "read-excel-file/node";

function createCell(value) {
  return { value: value ?? null };
}

function createRow(cells = []) {
  return {
    eachCell(callback) {
      cells.forEach((value, index) => {
        if (value !== null && value !== undefined) {
          callback(createCell(value), index + 1);
        }
      });
    },
    getCell(columnNumber) {
      return createCell(cells[columnNumber - 1]);
    },
  };
}

function createWorksheet({ sheet, data }) {
  return {
    name: sheet,
    rowCount: data.length,
    eachRow(callback) {
      data.forEach((cells, index) => {
        if (cells.some(value => value !== null && value !== undefined)) {
          callback(createRow(cells), index + 1);
        }
      });
    },
    getRow(rowNumber) {
      return createRow(data[rowNumber - 1]);
    },
  };
}

export async function readWorkbook(filePath) {
  const sheets = await readXlsxFile(filePath, { trim: false });
  return { worksheets: sheets.map(createWorksheet) };
}
