import * as React from 'react';
import {connect} from "react-redux";
import Paper from "@material-ui/core/Paper";
import {makeStyles} from "@material-ui/core/styles";
import Typography from "@material-ui/core/Typography";
import {setTransportTime} from "../actions/audioActions";

const useStyles = makeStyles(theme => ({
    track: {
        height: ({height}) => height,
    },
    layer: {
        position: "absolute",
        whiteSpace: "nowrap",
        height: ({height}) => height,
        width: ({durationPercent}) => `${durationPercent}%`,
        left: ({startTimePercent}) => `${startTimePercent}%`,
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-end",
        padding: [[2, theme.spacing(1)]],
        overflow: "hidden",
        cursor: "pointer",
        '&:hover': {
            overflow: "visible",
            backgroundColor: theme.palette.secondary["50"],
        },
        backgroundColor: theme.palette.background.paper,
        backgroundImage: ({rms}) => rms ? `url(${rms})` : '',
    }
}));

let Track = ({name, startTime, startTimePercent=0, durationPercent=100, rms, dispatch}) => {
    const classes = useStyles({
        height: 70,
        startTimePercent,
        durationPercent,
        rms,
    });
    return <div className={classes.track}>
        <Paper className={classes.layer} elevation={3} onClick={() => dispatch(setTransportTime(startTime))}>
            <Typography variant="caption">
                {name}
            </Typography>
        </Paper>
    </div>;
};

export default connect()(Track);