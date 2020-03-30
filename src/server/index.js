const express = require("express");
const app = express();
require('express-ws')(app);
const path = require("path");

const root = path.resolve(__dirname, "../../");

const webpack = require("webpack");
const webpackConfig = require("../../webpack.config");
const compiler = webpack(webpackConfig);
// webpack hmr
app.use(
    require("webpack-dev-middleware")(compiler, {
    noInfo: true,
    publicPath: webpackConfig.output.publicPath
})
);

app.use(require("webpack-hot-middleware")(compiler));

// static assets
app.use(express.static("static"));
app.use(express.static("dist"));

// main route
app.get("/", (req, res) =>
res.sendFile(path.resolve(root, "static/index.html")));


app.ws("/ws", (ws, req) => {
    ws.on("message", msg => {
        console.log("WS: ", msg);
        ws.send(msg);
    });
});

// app start up
app.listen(8080, () => console.log("App listening on port 8080!"));