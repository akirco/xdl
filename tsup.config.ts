import * as dotenv from "dotenv";
import { defineConfig } from "tsup";

dotenv.config();

const LIBRE_URL = process.env.XDL_LIBRE_URL ?? "";
const LIBRE_KEY = process.env.XDL_LIBRE_KEY ?? "";
const WHISPER_URL = process.env.XDL_WHISPER_URL ?? "";
const WHISPER_KEY = process.env.XVD_WHISPER_KEY ?? "";

export default defineConfig([
	{
		entry: ["src/cli.tsx"],
		format: ["esm"],
		target: "node18",
		banner: {
			js: "#!/usr/bin/env node",
		},
		bundle: true,
		splitting: false,
		clean: true,
		minify: false,
		sourcemap: false,
		external: [],
		esbuildOptions(options) {
			options.jsx = "automatic";
			options.define = {
				...options.define,
				__XDL_LIBRE_URL__: JSON.stringify(LIBRE_URL),
				__XDL_LIBRE_KEY__: JSON.stringify(LIBRE_KEY),
				__XDL_WHISPER_URL__: JSON.stringify(WHISPER_URL),
				__XVD_WHISPER_KEY__: JSON.stringify(WHISPER_KEY),
			};
		},
	},
	{
		entry: ["src/index.ts"],
		format: ["esm"],
		target: "esnext",
		dts: true,
		outDir: "lib",

		bundle: true,
		splitting: false,
		clean: false,
		minify: false,
		sourcemap: false,
	},
]);
