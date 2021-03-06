import * as React from 'react';
import clsx from 'clsx';
import {connect} from "react-redux";
import {useCallback, useEffect, useRef, useState} from "react";
import {
    play,
    stop,
    startRecording,
    stopRecording,
    init,
    reset,
    seek,
} from "../actions/audioActions";
import Layer from "./Layer";
import {makeStyles} from "@material-ui/core/styles";
import Divider from "@material-ui/core/Divider";
import Button from "@material-ui/core/Button";
import ButtonGroup from "@material-ui/core/ButtonGroup";
import Typography from "@material-ui/core/Typography";
import List from "@material-ui/core/List";
import Transport from "./Layers";
import {doWebRTC, setConducting} from "../actions";
import LinearProgress from "@material-ui/core/LinearProgress";
import CalibrationDialog from "./dialogs/Calibration";
import DeviceSelectionDialog from "./dialogs/DeviceSelection";
import ProfileDialog from "./dialogs/Profile";
import AppBar from "@material-ui/core/AppBar";
import Drawer from "@material-ui/core/Drawer";
import Toolbar from "@material-ui/core/Toolbar";
import ListItem from "@material-ui/core/ListItem";
import IconButton from "@material-ui/core/IconButton";
import PeopleIcon from "@material-ui/icons/People";
import {Switch} from "@material-ui/core";
import SingerList from "./SingerList";
import Lyrics from "./Lyrics";
import {requestSpeak} from "../actions/rtcActions";

const useStyles = makeStyles(theme => ({
    root: {
        display: 'flex',
        height: "100%",
        overflow: "hidden",
        //position: 'relative',
        //alignItems: "stretch"
    },
    main: {
        flexGrow: 1,
        padding: 0,
        height: "auto",
        overflow: 'hidden',
        '& > *': {
            margin: theme.spacing(1)
        },
        display: "flex",
    },
    mainExpand: {
        marginLeft: -240,
    },
    appBar: {
        zIndex: theme.zIndex.drawer + 1,
    },
    title: {
        flexGrow: 1,
    },
    header: {
        display: "flex",
        justifyContent: "space-between"
    },
    sendProgress: {
        zIndex: theme.zIndex.drawer + 2,
        position: "absolute",
        top: 64,
        left: 0,
        right: 0,
    },
    track: {
        height: 70
    },
    video: {
        width: 320,
        height: 240,
        transform: "scaleX(1)",
    }
}));

let Home = ({dispatch, backingTrack, transportTime, layers, conducting, sending, user, rtcStarted, speaking, speaker}) => {
    const classes = useStyles();

    let [calibrationOpen, setCalibrationOpen] = useState(false);
    let [deviceSelectionOpen, setDeviceSelectionOpen] = useState(false);
    let [profileOpen, setProfileOpen] = useState(false);

    let [viewSingers, setViewSingers] = useState(true);

    let conductorVideoRef = useRef(null);
    let choirVideoRef = useRef(null);

    let pushToTalk = () => {
        dispatch(requestSpeak(!speaking));
    }

    useEffect(() => {
        if (user && !user?.name) {
            setProfileOpen(true);
        }
    }, [user?.name]);

    useEffect(() => {
        if (rtcStarted) {
            conductorVideoRef.current.srcObject = new MediaStream([window.rtcTracks.conductorVideo, window.rtcTracks.conductorAudio]);
            choirVideoRef.current.srcObject = new MediaStream([window.rtcTracks.choirVideo, window.rtcTracks.speakerAudio]);
        }
    },[rtcStarted])

    return <div className={classes.root}>
        <AppBar className={classes.appBar}>
            <Toolbar>
                <Typography variant="h6" className={classes.title}>Virtual Choir</Typography>
                {conducting && <>
                    <Switch checked={viewSingers} onChange={() => setViewSingers(!viewSingers)} color="default"/>
                    <IconButton onClick={() => setViewSingers(!viewSingers)} color={viewSingers ? 'inherit' : 'default'}><PeopleIcon/></IconButton>
                </>}
            </Toolbar>
        </AppBar>
        {conducting && <SingerList open={viewSingers}/>}

        <main className={clsx(classes.main, {[classes.mainExpand]: !viewSingers})}>
            <Toolbar/>
            <div className={classes.header}>
                <ButtonGroup color="primary" variant="contained">
                    <Button onClick={() => dispatch(init())}>Init</Button>
                    <Button onClick={() => dispatch(reset())}>Reset</Button>
                    <Button onClick={() => setDeviceSelectionOpen(true)}>Devices</Button>
                    <Button onClick={() => setCalibrationOpen(true)}>Calibrate</Button>
                </ButtonGroup>
                {(speaking || !speaker) ? <Button onClick={pushToTalk} color="primary" variant={speaking ? 'contained' : 'outlined'}>{speaking ? 'Mute' : 'Push to talk'}</Button> : <div>Now speaking: {speaker.name}</div>}
                <Typography variant={"h5"}>{user?.name}</Typography>
                {conducting ? <Typography variant="h5">Conductor</Typography> : <Typography variant="h5">Singer</Typography> }
            </div>
            <video className={classes.video} autoPlay={true} ref={conductorVideoRef}/>
            <video className={classes.video} autoPlay={true} ref={choirVideoRef}/>
            <Divider/>
            <ButtonGroup color="primary" variant="contained">
                <Button onClick={() => dispatch(loadBackingTrack({backingTrackId: "let-it-go", name: "Let It Go", url:"/let-it-go.mp3"}, conducting))}>Load backing track</Button>
                <Button onClick={() => dispatch(play(transportTime, true, conducting))}>Play</Button>
                <Button onClick={() => dispatch(stop(true, conducting))}>Stop</Button>
                <Button onClick={() => dispatch(seek(0, true, conducting))}>Rewind</Button>
                <Button onClick={() => dispatch(startRecording(true, conducting))}>Start Recorder</Button>
                <Button onClick={() => dispatch(stopRecording(true, conducting))}>Stop Recorder</Button>
            </ButtonGroup>
            <Divider/>
            <Typography variant="h1">{backingTrack?.name}</Typography>
            <Typography variant="h2">{transportTime != null ? transportTime.toFixed(2) : ''}</Typography>

            <Transport backingTrack={backingTrack} tracks={layers}/>

            <Lyrics lyrics={backingTrack?.lyrics}/>

            <List>
                {layers.map((layer, i) => <Layer key={i} layer={layer}/>)}
            </List>

            {Object.entries(sending).map(([transferId, {sentBytes, totalBytes}]) => <LinearProgress key={transferId}
                                                                                                    className={classes.sendProgress}
                                                                                                    variant="determinate"
                                                                                                    value={100*sentBytes/totalBytes}/>)}

            <CalibrationDialog open={calibrationOpen} onClose={() => setCalibrationOpen(false)}/>
            <DeviceSelectionDialog open={deviceSelectionOpen} onClose={() => setDeviceSelectionOpen(false)}/>

        </main>


    </div>;
};

export default connect(state => ({
    backingTrack: state.backingTrack,
    transportTime: state.transport.currentTime,
    layers: state.layers,
    conducting: state.conducting,
    sending: state.sending,
    user: state.user,
    rtcStarted: state.rtcStarted,
    speaking: state.speaking,
    speaker: state.speaker,
}))(Home);