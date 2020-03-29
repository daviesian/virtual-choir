const path = require("path");

let cssClassName = '[local]__[path][name]'; // We may choose to switch this to [contenthash:16] in production. Or not.
let context = path.resolve(__dirname, 'src');

module.exports = {
    presets: ["@babel/env", "@babel/preset-react"],
    plugins: ["@babel/plugin-proposal-optional-chaining",
        // This parses the imported css/scss for classes, mangles the names, then adds the appropriate class names to the generated react components. Even at runtime.
        // It does *not* do any actual transformation of the imported file, we rely on the css-loader to do that, as usual. Note that this and the css-loader must be configured
        // to mangle the class names in exactly the same way, or nothing will work. That's why cssClassName and context are factored out here.
        ["react-css-modules", {
            context: context,
            generateScopedName: cssClassName,
            filetypes: {
                '.scss': {syntax: 'postcss-scss'}
            }
        }],
        ["react-hot-loader/babel"]],
};