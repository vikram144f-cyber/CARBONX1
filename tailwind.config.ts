import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./features/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        cx: {
          bg: "var(--cx-bg)",
          purple: "var(--cx-purple)",
          plum: "var(--cx-plum)",
          rose: "var(--cx-rose)",
          accent: "var(--cx-accent)",
          highlight: "var(--cx-highlight)",
          text: "var(--cx-text)",
          muted: "var(--cx-text-muted)",
        },
      },
    },
  },
  plugins: [],
};

export default config;
