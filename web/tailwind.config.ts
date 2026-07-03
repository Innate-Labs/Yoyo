import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#6d5efc",
          soft: "#eef0ff",
        },
        danger: {
          DEFAULT: "#e5484d",
          soft: "#ffefef",
        },
      },
    },
  },
  plugins: [],
};

export default config;
