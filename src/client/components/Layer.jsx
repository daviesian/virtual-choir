import * as React from 'react';
import {deleteLayer} from "../actions/audioActions";
import {connect} from "react-redux";

let Layer = ({layer, dispatch}) => {
    return <li key={layer.id}>{layer.name} ({layer.duration.toFixed(2)} seconds) <button onClick={() => dispatch(deleteLayer(layer.id))}>X</button></li>
};

export default connect()(Layer);