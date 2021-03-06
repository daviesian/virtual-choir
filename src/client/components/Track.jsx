import * as React from 'react';
import {connect} from "react-redux";
import Paper from "@material-ui/core/Paper";
import {makeStyles} from "@material-ui/core/styles";
import Typography from "@material-ui/core/Typography";
import {seek} from "../actions/audioActions";
import {useCallback, useEffect, useRef} from "react";

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
        overflow: "visible",
        cursor: "pointer",
        '&:hover': {
            overflow: "visible",
            backgroundColor: theme.palette.secondary["50"],
        },
        opacity: ({enabled}) => enabled ? 1 : 0.5,
        backgroundColor: theme.palette.background.paper,
        backgroundImage: ({rms}) => rms ? `url(${rms})` : '',
    },
    video: {
        position: "absolute",
        height: "100%",
        right: "100%",
        margin: [[2, theme.spacing(1)]],
        opacity: 1,
        transition: "opacity 0.5s ease-in",
        borderRadius: 4,
    },
    hidden: {
        opacity: 0,
    }
}));

let Track = ({layerId, isBackingTrack=false, name, startTime, duration, startTimePercent=0, durationPercent=100, rms, enabled, conducting, transportTime, dispatch}) => {
    const classes = useStyles({
        height: 70,
        startTimePercent,
        durationPercent,
        rms,
        enabled: isBackingTrack || enabled,
    });


    const trackClick = useCallback(e => {
        if (isBackingTrack) {
            dispatch(seek(duration * (e.pageX - e.target.getBoundingClientRect().left) / e.target.getBoundingClientRect().width, true, conducting))
        } else {
            dispatch(updateLayer({layerId, enabled: !enabled}, conducting));
        }
    });

    let videoRef = useRef();
    useEffect(() => {
        if (videoRef.current) {
            if (transportTime > startTime && transportTime < startTime + duration) {
                console.log("PLAY")
                videoRef.current.play();
            } else {
                videoRef.current.pause();
                videoRef.current.currentTime = 0;
            }
        }
    },[transportTime > startTime]);

    return <div className={classes.track}>
        <Paper className={classes.layer} elevation={3} onClick={trackClick}>
            <Typography variant="caption">
                {name}
            </Typography>
            <video className={`${classes.video} ${(transportTime > startTime && transportTime < startTime + duration && enabled) ? '' : classes.hidden}`} ref={videoRef} autoPlay={false} muted={true} src={`/.layers/${layerId}.vid`}/>
        </Paper>
    </div>;
};

export default connect(state => ({
    conducting: state.conducting,
    transportTime: state.transport.currentTime,
}))(Track);