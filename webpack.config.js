const path = require("path");
const CopyWebpackPlugin = require("copy-webpack-plugin");
module.exports = [
	// extension (Node)
	{
		target: "node",
		entry: "./src/extension.ts",
		output: {
			path: path.resolve(__dirname, "out/src"),
			filename: "extension.js",
			libraryTarget: "commonjs2",
		},
		devtool: "source-map",
		externals: { vscode: "commonjs vscode" },
		resolve: { extensions: [".ts", ".js"] },
		module: { rules: [{ test: /\.ts$/, use: "ts-loader" }] },
		plugins: [
			new CopyWebpackPlugin({
				patterns: [
					{
						from: "assets/colors-template.json",
						to: path.resolve(__dirname, "out/assets/colors-template.json"),
					},
				],
			}),
		],
	},
	// webview (browser)
	{
		target: "web",
		entry: "./media/webview.ts",
		output: {
			path: path.resolve(__dirname, "out/media"),
			filename: "webview.js",
		},
		devtool: "source-map",
		resolve: { extensions: [".ts", ".js"] },
		module: { rules: [{ test: /\.ts$/, use: "ts-loader" }] },
	},
];
