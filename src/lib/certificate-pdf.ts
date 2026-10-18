/** Dependency-free single-page PDF (A4 landscape). Swap for pdf-lib/react-pdf if you need branding. */
export function renderCertificatePdf(c: { serial: string; learner_name: string; course_title: string; issued_at: string }): Uint8Array {
  const esc = (s: string) => s.replace(/[\\()]/g, "\\$&").replace(/[^\x20-\x7E]/g, "?");
  const date = new Date(c.issued_at).toISOString().slice(0, 10);
  const lines = [
    ["F2", 34, 421, 440, "Certificate of Completion"],
    ["F1", 16, 421, 390, "This certifies that"],
    ["F2", 28, 421, 345, c.learner_name],
    ["F1", 16, 421, 305, "has successfully completed"],
    ["F2", 24, 421, 265, c.course_title],
    ["F1", 12, 421, 200, `Issued ${date}  |  Serial ${c.serial}`],
    ["F1", 11, 421, 180, "Verify at /verify/" + c.serial],
  ] as const;
  const content = lines.map(([f, size, cx, y, t]) => {
    const w = esc(t).length * size * 0.5; return `BT /${f} ${size} Tf ${Math.max(40, cx - w / 2)} ${y} Td (${esc(t)}) Tj ET`;
  }).join("\n") + "\n2 w 30 30 782 535 re S";
  const objs = [
    "<< /Type /Catalog /Pages 2 0 R >>", "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 842 595] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>",
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>", "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
  ];
  let pdf = "%PDF-1.4\n"; const offs: number[] = [];
  objs.forEach((o, i) => { offs.push(pdf.length); pdf += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = pdf.length;
  pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + offs.map((o) => String(o).padStart(10, "0") + " 00000 n \n").join("");
  pdf += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new TextEncoder().encode(pdf);
}
