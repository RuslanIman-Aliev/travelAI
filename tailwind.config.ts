import type { Config } from "tailwindcss";
import defaultTheme from "tailwindcss/defaultTheme"; 

const config = {
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", ...defaultTheme.fontFamily.sans],
      },
    },
  },
  // ...
} satisfies Config;

export default config;