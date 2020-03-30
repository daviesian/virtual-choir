import log from 'loglevel';

window.log = log;

import * as jQuery from "jquery";
window.$ = window.jQuery = jQuery;


import * as React from "react";
import * as ReactDOM from "react-dom";

import App from './components/App'
import CssBaseline from "@material-ui/core/CssBaseline";

ReactDOM.render(<App/>, document.getElementById("react-root"));
