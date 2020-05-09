import * as React from 'react';
import {connect} from "react-redux";
import Paper from "@material-ui/core/Paper";
import makeStyles from "@material-ui/core/styles/makeStyles";
import PlayArrowIcon from "@material-ui/icons/PlayArrow";
import StopIcon from "@material-ui/icons/Stop";
import SkipPreviousIcon from "@material-ui/icons/SkipPrevious";
import FiberManualRecordIcon from '@material-ui/icons/FiberManualRecord';
import RadioButtonUncheckedIcon from '@material-ui/icons/RadioButtonUnchecked';
import Fab from "@material-ui/core/Fab";
import green from "@material-ui/core/colors/green";
import blueGrey from "@material-ui/core/colors/blueGrey";
import red from "@material-ui/core/colors/red";
import {play, seek, startRecording, stop} from "../actions/audioActions";
import LinearProgress from "@material-ui/core/LinearProgress";
import grey from "@material-ui/core/colors/grey";
import Button from "@material-ui/core/Button";
import Typography from "@material-ui/core/Typography";

import format from 'format-duration';
import {useCallback, useRef} from "react";
import clsx from "clsx";

let useStyles = makeStyles(theme => ({
    root: {
        backgroundColor: grey[50],
    },
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
        backgroundColor: red[500],
        color: 'white',
        '&:hover': {
            backgroundColor: red[200],
        },
    },
    timer: {
        display: 'inline-block',
        marginLeft: theme.spacing(5),
        verticalAlign: 'middle',
    },
    progress: {
        height: 20,
        margin: [[0, theme.spacing(4)]],
        cursor: "pointer",
    }
}));

const Transport = ({className, transportTime, state, items, conducting, dispatch}) => {

    let classes = useStyles({state});

    let endTime = null;
    for (let [itemId, item] of Object.entries(items || {})) {
        endTime = Math.max(endTime || 0, item.startTime + item.duration);
    }

    let progressBar = useRef(null);
    let progressClick = useCallback(e => {
        if (endTime && progressBar.current) {
            dispatch(seek(endTime * (e.pageX - progressBar.current.getBoundingClientRect().left) / progressBar.current.getBoundingClientRect().width, true, conducting))
        }
    });

    return <Paper square elevation={0} className={clsx(className, classes.root)}>
        <div className={classes.controls}>
            <Fab className={classes.rewindButton} size={'small'} onClick={() => {dispatch(stop(true, conducting)); dispatch(seek(0, true, conducting))}}><SkipPreviousIcon/></Fab>
            {!state
                ? <Fab className={classes.playButton} onClick={() => dispatch(play(transportTime, true, conducting))}><PlayArrowIcon/></Fab>
                : <Fab className={classes.stopButton} onClick={() => dispatch(stop(true, conducting))}><StopIcon/></Fab>}
            <Fab className={classes.recordButton} size={'small'} onClick={() => dispatch(startRecording(true, conducting))}>{state === 'recording' ? <RadioButtonUncheckedIcon/> : <FiberManualRecordIcon/>}</Fab>
            <Typography variant={"h4"} className={classes.timer}>{format(transportTime*1000)}{endTime && ` / ${format(endTime*1000)}`}</Typography>
        </div>
        <div>
            <LinearProgress ref={progressBar} onClick={progressClick} className={classes.progress} variant={((endTime && transportTime < endTime) || !state) ? 'determinate' : 'indeterminate'} value={endTime ? 100 * transportTime / endTime : 0} />
        </div>
    </Paper>;
};

export default connect(state => ({
    transportTime: state.transport.currentTime,
    conducting: state.conducting,
    state: state.transport.state,
    items: state.items,
}))(Transport);