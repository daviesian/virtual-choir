import * as React from 'react';
import {connect} from "react-redux";
import List from "@material-ui/core/List";
import ListItem from "@material-ui/core/ListItem";
import ListItemText from "@material-ui/core/ListItemText";
import {seek} from "../actions/audioActions";
import {makeStyles} from "@material-ui/core/styles";
import {useCallback, useEffect, useRef} from "react";
import {setRehearsalState} from "../actions";
import PlayArrowIcon from "@material-ui/icons/PlayArrow";
import Paper from "@material-ui/core/Paper";

const useStyles = makeStyles(theme => ({
    lyricsBlock: {
        overflowY: "auto",
        margin: [[0, "auto"]],
        width: "max-content",
    }
}));


let Lyrics = ({lyrics, rehearsalState, conducting, transportTime, dispatch, ...props}) => {
    let classes = useStyles();

    let currentLineRef = useRef();

    let clickLine = useCallback((line, isCurrentLine) => {
        if (isCurrentLine) {
            dispatch(setRehearsalState({cursor: line.start}, conducting));
        }
        dispatch(seek(line.start, true, conducting));

    }, [conducting]);

    let scrollLine = null;
    let lyricLines = lyrics?.map(line => {
            let currentLine = transportTime !== null && transportTime >= line.start && transportTime < line.end;
            if (!scrollLine && transportTime < line.end) {
                scrollLine = line;
            }
            return <ListItem ref={scrollLine === line ? currentLineRef : null} selected={currentLine} key={line.id} button
                             onClick={() => clickLine(line, currentLine)}>
                {rehearsalState?.cursor === line.start && <PlayArrowIcon/>}

                <ListItemText>{line.text}</ListItemText>
            </ListItem>
        }
    );

    useEffect(() => {
        if (currentLineRef.current) {
            currentLineRef.current.scrollIntoView({behavior: 'smooth', block: 'center'});
        }
    }, [scrollLine?.id]);

    return <Paper square elevation={0} style={{minHeight: 0, overflow: 'auto'}}>
        <List className={classes.lyricsBlock}>
            {lyricLines}
        </List>
    </Paper>;
};

export default connect(state => ({
    conducting: state.conducting,
    transportTime: state.transport?.currentTime,
    rehearsalState: state.rehearsalState,
    lyrics: state.backingTrack?.lyrics,
}))(Lyrics);