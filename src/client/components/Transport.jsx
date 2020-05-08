import * as React from 'react';
import {connect} from "react-redux";
import Paper from "@material-ui/core/Paper";
import makeStyles from "@material-ui/core/styles/makeStyles";
import PlayArrowIcon from "@material-ui/icons/PlayArrow";
import SkipPreviousIcon from "@material-ui/icons/SkipPrevious";
import FiberManualRecordIcon from '@material-ui/icons/FiberManualRecord';
import Fab from "@material-ui/core/Fab";
import green from "@material-ui/core/colors/green";
import blueGrey from "@material-ui/core/colors/blueGrey";
import red from "@material-ui/core/colors/red";

let useStyles = makeStyles(theme => ({
    controls: {
        width: 'max-content',
        margin: [[theme.spacing(3), 'auto']],
    },
    playButton: {
        backgroundColor: green[500],
        color: 'white',
        margin: [[0, theme.spacing(3)]],
    },
    rewindButton: {
        backgroundColor: blueGrey[500],
        color: 'white',
    },
    recordButton: {
        backgroundColor: red[500],
        color: 'white',
    },
    track: {
        backgroundImage: ({rms}) => `url(${rms})`,
        backgroundSize: "contain",
        height: 50,
    }
}));

const Transport = ({backingTrack}) => {

    let classes = useStyles({
        rms: backingTrack?.rms
    });

    return <Paper square elevation={0}>
        <div className={classes.controls}>
            <Fab className={classes.rewindButton} size={'small'}><SkipPreviousIcon/></Fab>
            <Fab className={classes.playButton}><PlayArrowIcon/></Fab>
            <Fab className={classes.recordButton} size={'small'}><FiberManualRecordIcon fontSize={'small'}/></Fab>
        </div>
        <div>
            <Paper className={classes.track}/>
        </div>
    </Paper>;
};

export default connect(state => ({
    backingTrack: state.backingTrack
}))(Transport);