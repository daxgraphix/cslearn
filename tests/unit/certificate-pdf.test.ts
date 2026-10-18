import { describe, expect, it } from "vitest";
import { renderCertificatePdf } from "@/lib/certificate-pdf";

describe("certificate pdf", () => {
  it("produces a PDF document", () => {
    const b = renderCertificatePdf({ serial: "CRT-2026-ABC", learner_name: "Asha Mwakyusa", course_title: "Network Security", issued_at: "2026-10-01T00:00:00Z" });
    expect(new TextDecoder().decode(b.slice(0, 8))).toBe("%PDF-1.4");
  });
});
