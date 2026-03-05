function escapePdfText(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function toPdfLines(text: string, maxLineLength = 88, maxLines = 160): string[] {
  const inputLines = text
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map(line => line.trim());

  const lines: string[] = [];
  for (const line of inputLines) {
    if (!line) {
      lines.push("");
      continue;
    }
    let cursor = line;
    while (cursor.length > maxLineLength) {
      lines.push(cursor.slice(0, maxLineLength));
      cursor = cursor.slice(maxLineLength);
      if (lines.length >= maxLines) {
        return lines;
      }
    }
    lines.push(cursor);
    if (lines.length >= maxLines) {
      return lines;
    }
  }

  return lines.slice(0, maxLines);
}

export function renderSimpleTextPdf(text: string): Buffer {
  const lines = toPdfLines(text);
  const contentBody = lines
    .map((line, idx) => `${idx === 0 ? "" : "T* "}(${escapePdfText(line)}) Tj`)
    .join("\n");

  const stream = `BT\n/F1 11 Tf\n50 800 Td\n14 TL\n${contentBody}\nET`;

  const objects: string[] = [];
  objects.push("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");
  objects.push("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n");
  objects.push(
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n"
  );
  objects.push(
    `4 0 obj\n<< /Length ${Buffer.byteLength(stream, "utf8")} >>\nstream\n${stream}\nendstream\nendobj\n`
  );
  objects.push("5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n");

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [0];

  for (const obj of objects) {
    offsets.push(Buffer.byteLength(pdf, "utf8"));
    pdf += obj;
  }

  const xrefStart = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let i = 1; i <= objects.length; i += 1) {
    pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

  return Buffer.from(pdf, "utf8");
}
