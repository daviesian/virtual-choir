const path = require("path");
const webpack = require("webpack");
const player = require('node-wav-player');
const CopyWebpackPlugin = require('copy-webpack-plugin')
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin;

let cssClassName = '[local]__[path][name]'; // We may choose to switch this to [contenthash:16] in production. Or not.
let context = path.resolve(__dirname, 'src');

module.exports = {
    entry: ['@babel/polyfill', 'react-hot-loader/patch', "./index.jsx"],
    mode: "development",
    context: context,
    module: {
        rules: [
            {
                test: /\.(js|jsx)$/,
                exclude: /(node_modules)/,
                use: ["babel-loader"],
            },
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
            }
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
        filename: "virtual-choir.js",
    },
    devtool: false, // We'll configure source maps ourselves, thanks very much.
    plugins: [
        // Produce a full source-map for CSS, because for some reason the eval-source-map doesn't work with inline sources. And we want inline sources, because they're much faster to build during development.
        new webpack.SourceMapDevToolPlugin({
            test: /\.s?css$/
        }),
        // Just build eval-source-map for JS, which is much faster than source-map, but only gives us line-level precision. That'll do for now.
        new webpack.EvalSourceMapDevToolPlugin({
            test: /\.jsx?$/
        }),
        // new MiniCssExtractPlugin({
        //     filename: 'choir.css',
        // }),
        //new BundleAnalyzerPlugin(),
    ],
    optimization: {
        splitChunks: {
            chunks: 'all',
        },
    },
    devServer: {
        contentBase: './static',
        hot: true
    },
};