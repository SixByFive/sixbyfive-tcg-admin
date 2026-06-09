/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        background:   "#16171c",
        surface:      "#191a20",
        "surface-alt":"#23243c",
        border:       "#31365e",
        accent:       "#2963FF",
        "accent-light":"#548dff",
        text:         "#f7f8fa",
        "text-muted": "#8f98bc",
        "text-dim":   "#5f6570",
        destructive:  "#ef4444",
        warning:      "#f59e0b",
        success:      "#22c55e",
      },
    },
  },
  plugins: [],
};
