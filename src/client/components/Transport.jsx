import * as React from 'react';
import {connect} from "react-redux";
import Paper from "@material-ui/core/Paper";
import makeStyles from "@material-ui/core/styles/makeStyles";
import PlayArrowIcon from "@material-ui/icons/PlayArrow";
import StopIcon from "@material-ui/icons/Stop";
import SkipPreviousIcon from "@material-ui/icons/SkipPrevious";
import FiberManualRecordIcon from '@material-ui/icons/FiberManualRecord';
import Fab from "@material-ui/core/Fab";
import green from "@material-ui/core/colors/green";
import blueGrey from "@material-ui/core/colors/blueGrey";
import red from "@material-ui/core/colors/red";
import {play, seek, startRecording, stop} from "../actions/audioActions";
import LinearProgress from "@material-ui/core/LinearProgress";
import grey from "@material-ui/core/colors/grey";
import Button from "@material-ui/core/Button";

let useStyles = makeStyles(theme => ({
    controls: {
        width: 'max-content',
        margin: [[theme.spacing(3), 'auto']],
    },
    playButton: {
        backgroundColor: green[500],
        color: 'white',
        margin: [[0, theme.spacing(3)]],
        '&:hover': {
            backgroundColor: green[200],
        }
    },
    stopButton: {
        backgroundColor: grey[800],
        color: 'white',
        margin: [[0, theme.spacing(3)]],
        '&:hover': {
            backgroundColor: grey[600],
        }
    },
    rewindButton: {
        backgroundColor: blueGrey[500],
        color: 'white',
        '&:hover': {
            backgroundColor: blueGrey[300],
        }
    },
    recordButton: {
        backgroundColor: 'white',//red[500],
        color: red[500],//'white',
        '&:hover': {
            backgroundColor: red[50],
        }
    },
    progress: {
        height: 20,
        margin: [[0, theme.spacing(4)]],
    }
}));

const Transport = ({transportTime, state, conducting, dispatch}) => {

    let classes = useStyles();

    return <Paper square elevation={0}>
        <div className={classes.controls}>
            <Fab className={classes.rewindButton} size={'small'} onClick={() => dispatch(seek(0, true, conducting))}><SkipPreviousIcon/></Fab>
            {!state
                ? <Fab className={classes.playButton} onClick={() => dispatch(play(transportTime, true, conducting))}><PlayArrowIcon/></Fab>
                : <Fab className={classes.stopButton} onClick={() => dispatch(stop(true, conducting))}><StopIcon/></Fab>}
            <Fab className={classes.recordButton} size={'small'} onClick={() => dispatch(startRecording(true, conducting))}><FiberManualRecordIcon/></Fab>
            <div>{transportTime.toFixed(2)}</div>
        </div>
        <div>
            <LinearProgress className={classes.progress} variant={"determinate"} value={30}/>
        </div>
    </Paper>;
};

export default connect(state => ({
    transportTime: state.transport.currentTime,
    conducting: state.conducting,
    state: state.transport.state,
}))(Transport);