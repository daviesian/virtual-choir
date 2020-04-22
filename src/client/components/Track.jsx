import * as React from 'react';
import {connect} from "react-redux";
import Paper from "@material-ui/core/Paper";
import {makeStyles} from "@material-ui/core/styles";
import Typography from "@material-ui/core/Typography";
import {seek, updateLayer} from "../actions/audioActions";
import {useCallback} from "react";

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
        opacity: ({enabled}) => enabled ? 1 : 0.5,
        backgroundColor: theme.palette.background.paper,
        backgroundImage: ({rms}) => rms ? `url(${rms})` : '',
    }
}));

let Track = ({id, isBackingTrack=false, name, startTime, duration, startTimePercent=0, durationPercent=100, rms, enabled, conducting, dispatch}) => {
    const classes = useStyles({
        height: 70,
        startTimePercent,
        durationPercent,
        rms,
        enabled: isBackingTrack || enabled,
    });


    const trackClick = useCallback(e => {
        if (isBackingTrack) {
            dispatch(seek(duration * (e.pageX - e.target.getBoundingClientRect().left) / e.target.getBoundingClientRect().width, conducting))
        } else {
            dispatch(updateLayer({id, enabled: !enabled}, conducting));
        }
    });

    return <div className={classes.track}>
        <Paper className={classes.layer} elevation={3} onClick={trackClick}>
            <Typography variant="caption">
                {name}
            </Typography>
        </Paper>
    </div>;
};

export default connect(state => ({
    conducting: state.conducting,
}))(Track);