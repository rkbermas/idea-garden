import type { Config } from "tailwindcss";

const v = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

const config: Config = {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: v("paper"),
        sheet: v("sheet"),
        sunk: v("sunk"),
        ink: v("ink"),
        stem: v("stem"),
        faint: v("faint"),
        line: v("line"),
        juniper: v("juniper"),
        moss: v("moss"),
        bloom: v("bloom"),
        rust: v("rust"),
      },
      fontFamily: {
        serif: ['"Literata Variable"', "Literata", "Iowan Old Style", "Georgia", "serif"],
        sans: ['"Instrument Sans Variable"', "Instrument Sans", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
      },
      fontSize: {
        // modular scale ~1.2 (minor third) anchored at 15px UI / 18px reading
        "2xs": ["0.6875rem", { lineHeight: "1rem" }],
        xs: ["0.75rem", { lineHeight: "1.1rem" }],
        sm: ["0.8125rem", { lineHeight: "1.25rem" }],
        base: ["0.9375rem", { lineHeight: "1.5rem" }],
        read: ["1.125rem", { lineHeight: "1.85rem" }],
        lead: ["1.3125rem", { lineHeight: "2rem" }],
        title: ["1.625rem", { lineHeight: "2.125rem" }],
        display: ["2.125rem", { lineHeight: "2.6rem" }],
      },
      maxWidth: { read: "42rem", wide: "56rem" },
      keyframes: {
        rise: { from: { opacity: "0", transform: "translateY(6px)" }, to: { opacity: "1", transform: "none" } },
        fade: { from: { opacity: "0" }, to: { opacity: "1" } },
        sprout: { from: { opacity: "0", transform: "scale(.96)" }, to: { opacity: "1", transform: "none" } },
      },
      animation: {
        rise: "rise .22s cubic-bezier(.2,.7,.2,1) both",
        fade: "fade .18s ease-out both",
        sprout: "sprout .18s cubic-bezier(.2,.7,.2,1) both",
      },
    },
  },
  plugins: [],
};
export default config;
