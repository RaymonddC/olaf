import type { Config } from "tailwindcss";
import { olafTheme } from "../docs/design-system/tailwind-theme";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: olafTheme,
  },
  plugins: [],
};

export default config;
