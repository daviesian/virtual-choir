const path = require("path");
const webpack = require("webpack");
const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin;
const nodeExternals = require('webpack-node-externals');

let context = path.resolve( './src');

module.exports = {
    entry: ['@babel/polyfill', 'webpack-hot-middleware/client', 'react-hot-loader/patch', "./client/index.jsx"],
    mode: "development",
    context: context,
    module: {
        rules: [
            {
                test: /\.(js|jsx)$/,
                exclude: /(node_modules)/,
                use: ["babel-loader"],
            }/*,
            {
                test: /\.s?css$/,
                use: [
                    "style-loader",
                    // {
                    //     loader: MiniCssExtractPlugin.loader,
                    //     options: {
                    //         hmr: true,
                    //     }
                    // },
                    {
                        loader: "css-loader",
                        options: {
                            sourceMap: true,
                            importLoaders: 1, // Process css imports as sass.
                            modules: { // Mangle class names to match the names we expect in React.
                                context: context,
                                localIdentName: cssClassName,
                            },
                        }
                    },
                    {
                        loader: "sass-loader",
                        options: {
                            sourceMap: true
                        }
                    }
                ]
            }*/
        ]
    },
    resolve: {
        extensions: ["*", ".js", ".jsx", ".scss", ".css"],
        alias: {
            'react-dom': '@hot-loader/react-dom',
        },
        modules: ["node_modules"],
    },
    output: {
        path: path.resolve(__dirname, "dist"),
        publicPath: "/",
        filename: "client.js",
    },
    devtool: false, // We'll configure source maps ourselves, thanks very much.
    plugins: [
        // Just build eval-source-map for JS, which is much faster than source-map, but only gives us line-level precision. That'll do for now.
        new webpack.EvalSourceMapDevToolPlugin({
            test: /\.jsx?$/
        }),
        new webpack.HotModuleReplacementPlugin(),
    ],
    optimization: {
        splitChunks: {
            chunks: 'all',
        },
    }
};