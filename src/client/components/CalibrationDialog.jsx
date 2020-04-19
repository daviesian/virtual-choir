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


let CalibrationDialog = ({open, onClose, calibration, dispatch}) => {

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