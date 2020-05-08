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

let Layers = ({backingTrack, tracks=[], transportTime, rehearsalState, dispatch}) => {
    if (!backingTrack)
        return null;

    const classes = useStyles({
        backingTrack
    });

    return <div className={classes.root}>
        <List className={classes.trackList}>
            <Track isBackingTrack={true} {...backingTrack}/>
            {tracks.map(t => <Track key={t.layerId} enabled={t.enabled} startTime={t.startTime} duration={t.duration} startTimePercent={100*t.startTime / backingTrack.duration} durationPercent={100*t.duration / backingTrack.duration} {...t}/>)}
            {transportTime!==null && <TransportCursor line={true}  timePercent={100*transportTime / backingTrack.duration}/>}
            {rehearsalState?.cursor && <TransportCursor line={false} arrow={true} timePercent={100*rehearsalState.cursor / backingTrack.duration}/>}
        </List>
    </div>
};

export default connect(state =>({
    transportTime: state.transport.currentTime,
    rehearsalState: state.rehearsalState,
}))(Layers);