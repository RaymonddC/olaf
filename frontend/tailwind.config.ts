import type { Config } from "tailwindcss";
import { cariaTheme } from "../docs/design-system/tailwind-theme";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: cariaTheme,
  },
  plugins: [],
};

export default config;
