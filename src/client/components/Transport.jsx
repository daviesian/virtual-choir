import * as React from 'react';
import {connect} from "react-redux";
import List from "@material-ui/core/List";
import Track from "./Track";
import {makeStyles} from "@material-ui/core/styles";
import TransportCursor from "./TransportCursor";

const useStyles = makeStyles(theme => ({
    root: {
        overflowX: 'auto',
        overflowY: 'hidden',
        position: "relative",
    },
    trackList: {
        width: ({backingTrack}) => backingTrack.duration * 20,
        position: "relative",
        '& > *': {
            margin: [[theme.spacing(1), 0]],
        },
    }
}));

let Transport = ({backingTrack, tracks=[], transportTime, dispatch}) => {
    if (!backingTrack)
        return null;

    const classes = useStyles({
        backingTrack
    });

    return <div className={classes.root}>
        <List className={classes.trackList}>
            <Track {...backingTrack}/>
            {tracks.map(t => <Track key={t.id} enabled={t.enabled} startTime={t.startTime} duration={t.duration} startTimePercent={100*t.startTime / backingTrack.duration} durationPercent={100*t.duration / backingTrack.duration} {...t}/>)}
            {transportTime!==null && <TransportCursor timePercent={100*transportTime / backingTrack.duration}/>}
        </List>
    </div>
};

export default connect(state =>({
    transportTime: state.transport.currentTime,
}))(Transport);