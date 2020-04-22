import Dialog from "@material-ui/core/Dialog";
import DialogTitle from "@material-ui/core/DialogTitle";
import DialogContent from "@material-ui/core/DialogContent";
import DialogActions from "@material-ui/core/DialogActions";
import Button from "@material-ui/core/Button";
import CheckCircleOutlinedIcon from '@material-ui/icons/CheckCircleOutlined';
import {startCalibration, stopCalibration} from "../actions/audioActions";
import * as React from "react";
import {connect} from "react-redux";
import Typography from "@material-ui/core/Typography";
import {CircularProgress, colors} from "@material-ui/core";
import LinearProgress from "@material-ui/core/LinearProgress";
import {makeStyles} from "@material-ui/core/styles";
import Replay from "@material-ui/icons/Replay";

let useStyles = makeStyles(theme => ({
    progress: {
        margin: [[theme.spacing(2), 0]],
        height: theme.spacing(1),
    }
}));

let CalibrationDialog = ({open, onClose, calibration, dispatch}) => {
    let classes = useStyles();

    let samplesPercent = Math.min(100, 100 * (calibration?.samples?.length || 0) / 3);
    let accuracyPercent = Math.max(10, 100 - Math.min(100, (calibration?.sd*1000 || 100)));

    let content = <Typography variant="body1">
        This calibration will measure the latency of your audio system. Make sure your surroundings are quiet before continuing.
    </Typography>;

    if (calibration?.type === "quiet") {
        content = <div style={{textAlign: "center"}}>
            <CircularProgress/>
            <Typography variant="subtitle2">
                Calibrating ambient noise level. Please stay quiet.
            </Typography>
        </div>;
    } else if (calibration?.type === "latency") {
        content = <div style={{textAlign: "center"}}>
            <CircularProgress/>
            <Typography variant="subtitle2">
                Calibrating audio delay. Please clap with the first of each four beats.
            </Typography>
            <LinearProgress variant="buffer" value={accuracyPercent} valueBuffer={samplesPercent} className={classes.progress}/>
            <Typography variant="caption">Samples: {calibration?.samples?.length || 0} | Mean latency: {Math.round(calibration?.mean*1000)} ms | SD: {Math.round(calibration?.sd*1000)} ms</Typography>
        </div>;
    } else if (calibration?.calibration) {
        content = <div style={{textAlign: "center"}}>
            <CheckCircleOutlinedIcon color="primary" fontSize="large"/>
            <Typography variant="subtitle2">
                Calibration done!
            </Typography>
            <Typography variant="caption">Latency {Math.round(calibration?.calibration.latency*1000)} ms</Typography>
        </div>;
    }

    return <Dialog open={open}>
        <DialogTitle>Audio Calibration</DialogTitle>
        <DialogContent dividers>
            {content}
        </DialogContent>
        <DialogActions>
            {calibration?.type && !calibration?.calibration && <Button startIcon={<Replay/>} onClick={() => dispatch(stopCalibration())} autoFocus >
                Restart
            </Button>}
            {!calibration?.calibration && <Button onClick={e => {dispatch(stopCalibration()); return onClose(e);}} color="default">
                Cancel
            </Button>}
            {!calibration?.type && !calibration?.calibration && <Button variant="contained" onClick={() => dispatch(startCalibration())} autoFocus color="primary">
                Begin Calibration
            </Button>}
            {calibration?.calibration && <Button variant="contained" onClick={e => { onClose(e); dispatch(stopCalibration()); }} autoFocus color="primary">Done</Button>}
        </DialogActions>
    </Dialog>
};

export default connect(state => ({
    calibration: state.calibration,
}))(CalibrationDialog);