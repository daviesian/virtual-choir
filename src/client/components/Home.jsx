import * as React from 'react';
import {connect} from "react-redux";
import {useState} from "react";
import {
    play,
    stop,
    startRecording,
    stopRecording,
    deleteLayer,
    init,
    reset,
    seek, startCalibration, stopCalibration
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
import {Switch} from "@material-ui/core";
import {loadBackingTrack, setConducting} from "../actions";
import LinearProgress from "@material-ui/core/LinearProgress";
import Dialog from "@material-ui/core/Dialog";
import DialogTitle from "@material-ui/core/DialogTitle";
import DialogContent from "@material-ui/core/DialogContent";
import DialogActions from "@material-ui/core/DialogActions";
import CalibrationDialog from "./CalibrationDialog";
import DeviceSelectionDialog from "./DeviceSelectionDialog";

const useStyles = makeStyles(theme => ({
    root: {
        padding: 10,
        '& > *': {
            margin: theme.spacing(1)
        }
    },
    header: {
        display: "flex",
        justifyContent: "space-between"
    },
    sendProgress: {
        position: "absolute",
        top: -10,
        left: -10,
        right: -10,
    },
    track: {
        height: 70
    }
}));

let Home = ({dispatch, backingTrack, transportTime, layers, conducting, sending}) => {
    const classes = useStyles();

    let [calibrationOpen, setCalibrationOpen] = useState(false);
    let [deviceSelectionOpen, setDeviceSelectionOpen] = useState(false);

    return <div className={classes.root}>
        <div className={classes.header}>
            <ButtonGroup color="primary" variant="contained">
                <Button onClick={() => dispatch(init())}>Init</Button>
                <Button onClick={() => dispatch(reset())}>Reset</Button>
                <Button onClick={() => setDeviceSelectionOpen(true)}>Devices</Button>
                <Button onClick={() => setCalibrationOpen(true)}>Calibrate</Button>
            </ButtonGroup>
            {conducting ? <Typography variant="h5">Conductor</Typography> : <Typography variant="h5">Singer</Typography> }
        </div>
        <Divider/>
        <ButtonGroup color="primary" variant="contained">
            <Button onClick={() => dispatch(loadBackingTrack({id: "let-it-go", name: "Let It Go", url:"/let-it-go.mp3"}, conducting))}>Load backing track</Button>
            <Button onClick={() => dispatch(play(transportTime, true, conducting))}>Play</Button>
            <Button onClick={() => dispatch(stop(true, conducting))}>Stop</Button>
            <Button onClick={() => dispatch(seek(0, conducting))}>Rewind</Button>
            <Button onClick={() => dispatch(startRecording(true, conducting))}>Start Recorder</Button>
            <Button onClick={() => dispatch(stopRecording(true, conducting))}>Stop Recorder</Button>
        </ButtonGroup>
        <Divider/>
        <Typography variant="h1">{backingTrack?.name}</Typography>
        <Typography variant="h2">{transportTime != null ? transportTime.toFixed(2) : ''}</Typography>


        <Transport backingTrack={backingTrack} tracks={layers}/>
        <List>
            {layers.map((layer, i) => <Layer key={i} layer={layer}/>)}
        </List>

        {Object.entries(sending).map(([transferId, {sentBytes, totalBytes}]) => <LinearProgress key={transferId} className={classes.sendProgress} variant="determinate" value={100*sentBytes/totalBytes}/>)}

        <CalibrationDialog open={calibrationOpen} onClose={() => setCalibrationOpen(false)}/>
        <DeviceSelectionDialog open={deviceSelectionOpen} onClose={() => setDeviceSelectionOpen(false)}/>

    </div>;
};

export default connect(state => ({
    backingTrack: state.backingTrack,
    transportTime: state.transport.currentTime,
    layers: state.layers,
    conducting: state.conducting,
    sending: state.sending,
}))(Home);