import * as React from "react";
import * as ReactDOM from "react-dom";
import log from 'loglevel';
import App from './components/App'

window.log = log;

ReactDOM.render(<App/>, document.getElementById("react-root"));
