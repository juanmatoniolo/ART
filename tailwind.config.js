/** @type {import('tailwindcss').Config} */
module.exports = {
	content: ["./src/**/*.{js,jsx,ts,tsx}"],
	theme: {
		extend: {
			colors: {
				bg: "var(--bg)",
				surface: "var(--surface)",
				"surface-2": "var(--surface-2)",
				border: "var(--border)",
				text: "var(--text)",
				muted: "var(--muted)",
				accent: "var(--accent)",
				"accent-weak": "var(--accent-weak)",
			},
			boxShadow: {
				card: "var(--shadow)",
			},
			borderRadius: {
				xl2: "18px",
			},
		},
	},
	plugins: [],
};
