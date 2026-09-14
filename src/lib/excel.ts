import * as XLSX from 'xlsx';

/**
 * Export raw JSON data to a formatted Excel file (.xlsx).
 * Runs purely on the client-side.
 */
export function exportToExcel(data: Record<string, unknown>[], fileName: string, sheetName: string = 'Sheet1') {
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  
  // Set sheet styling width columns slightly wider
  const maxKeys = data.reduce((acc, row) => Math.max(acc, Object.keys(row).length), 0);
  const colWidths = Array(maxKeys).fill({ wch: 18 });
  worksheet['!cols'] = colWidths;

  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  XLSX.writeFile(workbook, `${fileName}.xlsx`);
}
