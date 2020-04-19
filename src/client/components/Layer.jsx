import * as React from 'react';
import {deleteLayer} from "../actions/audioActions";
import {connect} from "react-redux";

let Layer = ({layer, conducting, dispatch}) => {
    return <li key={layer.id}>{layer.name} ({layer.duration.toFixed(2)} seconds) <button onClick={() => dispatch(deleteLayer(layer.id, conducting))}>X</button></li>
};

export default connect(state => ({
    conducting: state.conducting,
}))(Layer);