import * as React from 'react';
import {connect} from "react-redux";
//import "./Home.scss";
import {useState} from "react";
import {useEffect} from "react";
import {
    loadBackingTrack,
    play,
    stop,
    startRecording,
    stopRecording,
    deleteLayer,
    init,
    reset,
    setTransportTime
} from "../actions/audioActions";
import Layer from "./Layer";
import {makeStyles} from "@material-ui/core/styles";
import Divider from "@material-ui/core/Divider";
import Button from "@material-ui/core/Button";
import ButtonGroup from "@material-ui/core/ButtonGroup";
import Typography from "@material-ui/core/Typography";
import List from "@material-ui/core/List";
import Paper from "@material-ui/core/Paper";
import Card from "@material-ui/core/Card";
import Transport from "./Transport";

const useStyles = makeStyles(theme => ({
    root: {
        padding: 10,
        '& > *': {
            margin: theme.spacing(1)
        }
    },
    track: {
        height: 70
    }
}));

let Home = ({dispatch, backingTrack, transportTime, layers}) => {
    const classes = useStyles();

     //let [time, setTime] = useState(0);

     // useEffect(() => {
     //     dispatch({type: "audio/addTransportTimeCallback", callback: setTime});
     //     return () => dispatch({type: "audio/removeTransportTimeCallback", callback: setTime});
     // }, []);

    return <div className={classes.root}>
        <ButtonGroup color="primary" variant="contained">
            <Button onClick={() => dispatch(init())}>Init</Button>
            <Button onClick={() => dispatch(reset())}>Reset</Button>
        </ButtonGroup>
        <Divider/>
        <ButtonGroup color="primary" variant="contained">
            <Button onClick={() => dispatch(loadBackingTrack("/stand-by-me.mp3"))}>Load backing track</Button>
            <Button onClick={() => dispatch(play(transportTime))}>Play</Button>
            <Button onClick={() => dispatch(stop())}>Stop</Button>
            <Button onClick={() => dispatch(setTransportTime(0))}>Rewind</Button>
            <Button onClick={() => dispatch(startRecording())}>Start Recorder</Button>
            <Button onClick={() => dispatch(stopRecording())}>Stop Recorder</Button>
        </ButtonGroup>
        <Divider/>
        <Typography variant="h1">{backingTrack?.name}</Typography>
        <Typography variant="h2">{transportTime != null ? transportTime.toFixed(2) : ''}</Typography>


        <Transport backingTrack={backingTrack} tracks={layers}/>
        <List>
            {layers.map((layer, i) => <Layer key={i} layer={layer}/>)}
        </List>
    </div>;
};

export default connect(state => ({
    backingTrack: state.backingTrack,
    transportTime: state.transport.currentTime,
    layers: state.layers,
}))(Home);