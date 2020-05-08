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
import {useEffect, useState} from "react";
import {initDevices} from "../actions/audioActions";
import {pageInteractionRequired} from "../util";
import Button from "@material-ui/core/Button";
import Dialog from "@material-ui/core/Dialog";
import DialogContent from "@material-ui/core/DialogContent";
import DialogTitle from "@material-ui/core/DialogTitle";
import DialogActions from "@material-ui/core/DialogActions";
import Main from "./Main";

setConfig({
    reloadHooks: false,
});

const theme = createMuiTheme({
    palette: {
        //type: "dark" ,
        background: { default: blue['50'] },
        primary: blue,
        secondary: orange,
        foo: orange,
    }
});

let App = ({}) => {

    let [launchPopup, setLaunchPopup] = useState(null);

    useEffect(() => {(async () => {
        window.store.dispatch(initDevices());

        setLaunchPopup(await pageInteractionRequired());
    })()},[]);

    useEffect(() => {
        if (launchPopup === false) {
            // We have explicitly decided that we're ready for audio. This will happen at most once.
            window.store.dispatch({
                type: "ws/connect",
            });
        }
    }, [launchPopup]);

    return <Provider store={store}>
        <Router history={history}>
            <ThemeProvider theme={theme}>
                <CssBaseline/>
                <SnackbarProvider maxSnack={3}>
                    {launchPopup ? <Dialog open={true}>
                        <DialogTitle>Welcome to the Choir!</DialogTitle>
                        <DialogActions><Button variant="contained" color="primary" onClick={async () => setLaunchPopup(await pageInteractionRequired())}>Get started</Button></DialogActions>
                    </Dialog> : <Main/>}
                </SnackbarProvider>
            </ThemeProvider>
            <AppRouter/>
        </Router>
    </Provider>;
};

export default hot(App);