import * as React from 'react';
import {connect, Provider} from 'react-redux';
import {createMuiTheme, ThemeProvider} from '@material-ui/core/styles';
import { Router} from "react-router-dom";
import {store, history} from "../store";
import { hot } from 'react-hot-loader/root';
import { setConfig } from 'react-hot-loader';
import Home from "./Home";
import {blue, green, orange, red} from "@material-ui/core/colors";
import {CssBaseline} from "@material-ui/core";
import AppRouter from "./AppRouter";
import { SnackbarProvider } from 'notistack';
import {useEffect} from "react";

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

let App = ({}) => {

    useEffect(() => {
        store.dispatch({
            type: "audio/initDevices",
        });
    },[]);

    return <Provider store={store}>
        <Router history={history}>
            <ThemeProvider theme={theme}>
                <CssBaseline/>
                <SnackbarProvider maxSnack={3}>
                    <Home/>
                </SnackbarProvider>
            </ThemeProvider>
            <AppRouter/>
        </Router>
    </Provider>;
};

export default hot(App);