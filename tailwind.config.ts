import type { Config } from "tailwindcss";

// Tokens follow the instructor-studio reference: quiet white surfaces, one blue action color,
// purple reserved for quizzes, amber for drafts, red for destructive actions.
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: "#2f5ba8", dark: "#264b8d", soft: "#e8eef8" },
        surface: { DEFAULT: "#ffffff", muted: "#f6f6f7", line: "#e6e7ea" },
        ink: { DEFAULT: "#1d1f24", soft: "#5b606b", faint: "#8b909b" },
        quiz: { DEFAULT: "#7c3aed", soft: "#f1eafe" },
        "quiz-soft": "#f1eafe",
        draft: "#e59e0b",
        danger: "#dc2626",
        ok: "#16a34a",
      },
      fontFamily: { sans: ["var(--font-sans)", "system-ui", "sans-serif"] },
      borderRadius: { xl2: "14px" },
      boxShadow: { card: "0 1px 2px rgba(16,24,40,.06), 0 1px 3px rgba(16,24,40,.08)" },
    },
  },
  plugins: [],
};
export default config;
