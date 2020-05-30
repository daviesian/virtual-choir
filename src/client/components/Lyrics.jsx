import * as React from 'react';
import {connect} from "react-redux";
import List from "@material-ui/core/List";
import ListItem from "@material-ui/core/ListItem";
import ListItemText from "@material-ui/core/ListItemText";
import {seek} from "../actions/audioActions";
import {makeStyles} from "@material-ui/core/styles";
import {useCallback, useEffect, useRef} from "react";
import {addLyrics, setRehearsalState} from "../actions";
import PlayArrowIcon from "@material-ui/icons/PlayArrow";
import AddIcon from "@material-ui/icons/Add";
import Paper from "@material-ui/core/Paper";
import Typography from "@material-ui/core/Typography";
import Fab from "@material-ui/core/Fab";
import CloudUploadIcon from "@material-ui/icons/CloudUpload";
import Button from "@material-ui/core/Button";

const useStyles = makeStyles(theme => ({
    lyricsBlock: {
        overflowY: "auto",
        margin: [[0, "auto"]],
        width: "max-content",
    },
    addContainer: {
        height: '100%',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
    },
    addIcon: {
        marginRight: theme.spacing(1)
    }
}));


let Lyrics = ({lyrics, rehearsalState, conducting, transportTime, dispatch, className}) => {
    let classes = useStyles();

    let currentLineRef = useRef();

    let clickLine = useCallback((line, isCurrentLine) => {
        if (isCurrentLine) {
            dispatch(setRehearsalState({...rehearsalState, cursor: line.start}, conducting));
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


    return <Paper square elevation={0} style={{minHeight: 0, overflow: 'auto'}} className={className}>
        {lyrics ? <List className={classes.lyricsBlock}>
            {lyricLines}
        </List> : <div className={classes.addContainer}>
            {conducting
                ? <>
                    <input
                        accept={'.srt'}
                        style={{ display: 'none' }}
                        id="file-upload-thing"
                        type="file"
                        onChange={e => dispatch(addLyrics(e.target.files[0]))}
                    />
                    <label htmlFor="file-upload-thing">
                        <Fab component='span' color={'default'} variant={'extended'}><AddIcon className={classes.addIcon}/> Add lyrics</Fab>
                    </label>
                </>
                : <Typography variant={'subtitle1'}>No lyrics available</Typography>}
        </div>}
    </Paper>;
};

export default connect(state => ({
    conducting: state.conducting,
    transportTime: state.transport?.currentTime,
    rehearsalState: state.room?.rehearsalState,
    lyrics: state.lyrics[state.project?.lyricsUrl],
}))(Lyrics);