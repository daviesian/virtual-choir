import log from 'loglevel';
import * as React from "react";
import * as ReactDOM from "react-dom";
import App from './components/App'

window.log = log;
log.setLevel("debug");


ReactDOM.render(<App/>, document.getElementById("react-root"));
