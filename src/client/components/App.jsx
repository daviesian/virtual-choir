import * as React from 'react';
import {Provider} from 'react-redux';
import {createMuiTheme, ThemeProvider} from '@material-ui/core/styles';
import { Router} from "react-router-dom";
import {store, history} from "../store";
import { hot } from 'react-hot-loader/root';
import { setConfig } from 'react-hot-loader';
import Home from "./Home";
import {blue, green, orange, red} from "@material-ui/core/colors";
import {CssBaseline} from "@material-ui/core";
import AppRouter from "./AppRouter";

setConfig({
    reloadHooks: true,
});

const theme = createMuiTheme({
    palette: {
        //type: "dark" ,
        background: { default: blue['50'] },
        primary: blue,
        secondary: orange,
    }
});

let App = ({dispatch}) => {

    return <Provider store={store}>
        <Router history={history}>
            <ThemeProvider theme={theme}>
                <CssBaseline/>
                <Home/>
            </ThemeProvider>
            <AppRouter/>
        </Router>
    </Provider>;
};

export default hot(App);