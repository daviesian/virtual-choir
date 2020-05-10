import * as React from 'react';
import clsx from 'clsx';
import {connect} from "react-redux";
import Container from "@material-ui/core/Container";
import Grid from "@material-ui/core/Grid";
import Paper from "@material-ui/core/Paper";
import {makeStyles} from "@material-ui/styles";
import AppBar from "@material-ui/core/AppBar";
import Toolbar from "@material-ui/core/Toolbar";
import Typography from "@material-ui/core/Typography";
import {Switch} from "@material-ui/core";
import IconButton from "@material-ui/core/IconButton";
import EmojiPeopleIcon from "@material-ui/icons/EmojiPeople";
import PeopleIcon from "@material-ui/icons/People";
import MicIcon from "@material-ui/icons/Mic";
import MicOffIcon from "@material-ui/icons/MicOff";
import SupervisorAccountIcon from '@material-ui/icons/SupervisorAccount';
import MusicNoteIcon from "@material-ui/icons/MusicNote";
import QueueMusicIcon from "@material-ui/icons/QueueMusic";
import ClearAllIcon from "@material-ui/icons/ClearAll";
import Button from "@material-ui/core/Button";
import ButtonGroup from "@material-ui/core/ButtonGroup";
import {useCallback, useEffect, useRef, useState} from "react";
import Sidebar from "./Sidebar";
import ProfileDialog from "./dialogs/Profile";
import Lyrics from "./Lyrics";
import Transport from "./Transport";
import Tracks from "./tracks/Tracks";
import Fab from "@material-ui/core/Fab";
import green from "@material-ui/core/colors/green";
import red from "@material-ui/core/colors/red";
import {requestSpeak, rtcMute, rtcUnmute} from "../actions/rtcActions";

const useStyles = makeStyles(theme => ({
    rootContainer: {
        display: 'flex',
        flexDirection: 'column',
        height: "100%",
    },
    appBarOffset: theme.mixins.toolbar,
    grid: ({sidebarWidth, myVideoAspectRatio}) => ({
        flexGrow: 1,
        minHeight: 0,
        backgroundColor: '#cecece',
        display: 'grid',
        gridTemplateColumns: [[sidebarWidth,sidebarWidth,'auto',sidebarWidth]],
        gridTemplateRows: [['1fr', 'minmax(min-content,200px)']],
    }),
    navButton: {
        margin: [[0, 10]],
    },
    myVideo: {
        width: ({sidebarWidth}) => sidebarWidth,
    },
    mainPanelVideoHolder: {
        position: 'relative',
    },
    mainPanelVideo: {
        height: "100%",
        display: "block",
        margin: [[0, 'auto']],
    },
    topLeft: {
        gridColumn: '1 / 2',
        gridRow: '1 / 2',
    },
    topRight: {
        gridColumn: '2 / 5',
        gridRow: '1 / 2',
    },
    topRow: {
        gridColumn: '1 / 5',
        gridRow: '1 / 2',
    },
    bottom: {
        gridRow: '2 / 3',
    },
    bottomLeft: {
        gridColumn: '1 / 2',
        gridRow: '2 / 3',
    },
    bottomRight: {
        gridColumn: '2 / 5',
        gridRow: '2 / 3',
    },
    tracks: {
        gridColumn: 'span 2',
    },
    videoContainer: {
        position: 'relative',
    },
    video: {
        position: 'absolute',
        width: '100%',
        height: '100%',
        display: 'block',
        objectPosition: 'center'
    },
    cover: {
        objectFit: 'cover',
    },
    videoOverlay: {
        position: 'absolute',
        width: '100%',
        height: '100%',
    },
    mute: {
        margin: theme.spacing(2),
        backgroundColor: green[100],
        color: green[900],
    },
    muted: {
        backgroundColor: red[100],
        color: red[900],
    }
}));

const Grow = () => <div style={{flexGrow: 1}}/>;

const Video = ({stream, className, classes, muted, cover, children, ...props}) => {
    let ref = useRef(null);

    useEffect(() => {
        if (ref.current && stream) {
            ref.current.srcObject = stream;
        }
    }, [ref.current, stream]);

    return <div className={clsx(className, classes.videoContainer)} {...props}>
        <video className={clsx(classes.video, cover && classes.cover)} autoPlay={true} ref={ref} muted={muted}/>
        <div className={classes.videoOverlay}>
            {children}
        </div>
    </div>;
};

const Main = ({rtcStarted, user, conducting, muted, speaker, speaking, dispatch}) => {
    const sidebarWidth = 300;

    let classes = useStyles({
        sidebarWidth,
    });

    let [selectedPanel, setSelectedPanel] = useState('tracks');
    let [profileOpen, setProfileOpen] = useState(false);

    useEffect(() => {
        if (user && !user?.name) {
            setProfileOpen(true);
        }
    }, [user?.name]);

    let [conductorVideoStream, setConductorVideoStream] = useState(null);
    let [choirVideoStream, setChoirVideoStream] = useState(null);
    let [myVideoStream, setMyVideoStream] = useState(null);

    useEffect(() => {
        if (rtcStarted) {
            setMyVideoStream(new MediaStream([window.rtcTracks.myVideo]));
            setChoirVideoStream(new MediaStream([window.rtcTracks.choirVideo, window.rtcTracks.speakerAudio]));
            setConductorVideoStream(new MediaStream([window.rtcTracks.conductorVideo, window.rtcTracks.conductorAudio]))
        }
    },[rtcStarted])

    let mainPanel = <div/>;

    switch(selectedPanel) {
        case 'conductor':
            mainPanel = <div className={clsx(classes.mainPanelVideoHolder, classes.topRight)}><Video className={classes.mainPanelVideo} classes={classes} muted={true} stream={conductorVideoStream}/></div>;
            break;
        case 'choir':
            mainPanel = <div className={clsx(classes.mainPanelVideoHolder, classes.topRight)}><Video className={classes.mainPanelVideo} classes={classes} muted={true} stream={choirVideoStream}/></div>;
            break;
        case 'score':
            mainPanel = <Paper className={classes.topRight}>Score</Paper>;
            break;
        case 'lyrics':
            mainPanel = <Lyrics className={classes.topRight}/>;
            break;
        case 'tracks':
            mainPanel = <Tracks sidebarWidth={sidebarWidth} className={classes.topRow}/>;
            break;
    }

    let muteClick = useCallback(() => {
        if (conducting) {
            dispatch(muted ? rtcUnmute() : rtcMute());
        } else {
            dispatch(requestSpeak(!speaking))
        }
    });

    muted = (conducting && muted) || (!conducting && !speaking);

    return <Container className={clsx(classes.rootContainer)} maxWidth={false} disableGutters={true}>
        <AppBar>
            <Toolbar>
                <Typography variant="h6" className={classes.title}>Virtual Choir</Typography>
                <Grow/>
                {!conducting && <Button onClick={() => setSelectedPanel('conductor')} className={classes.navButton} color={'inherit'} startIcon={<EmojiPeopleIcon/>}>Conductor</Button>}
                <Button onClick={() => setSelectedPanel('choir')} className={classes.navButton} color={'inherit'} startIcon={<SupervisorAccountIcon/>}>Choir</Button>
                <Button onClick={() => setSelectedPanel('score')} className={classes.navButton} color={'inherit'} startIcon={<MusicNoteIcon/>}>Score</Button>
                <Button onClick={() => setSelectedPanel('lyrics')} className={classes.navButton} color={'inherit'} startIcon={<QueueMusicIcon/>}>Lyrics</Button>
                <Button onClick={() => setSelectedPanel('tracks')} className={classes.navButton} color={'inherit'} startIcon={<ClearAllIcon/>}>Tracks</Button>
            </Toolbar>
        </AppBar>
        <div className={classes.appBarOffset}/>
            <div className={classes.grid}>
                {selectedPanel !== 'tracks' && <Sidebar className={classes.topLeft}/>}
                {mainPanel}
                <Video className={clsx(classes.bottom, classes.myVideo)} cover={true} classes={classes} style={{gridColumn: '1 / 2'}} stream={conducting ? myVideoStream : conductorVideoStream}/>
                <Video className={clsx(classes.bottom, classes.myVideo)} cover={true} classes={classes} style={{gridColumn: '2 / 3'}} stream={choirVideoStream}/>
                <Transport className={classes.bottom} style={{gridColumn: '3 / 4'}}/>
                <Video className={clsx(classes.bottom, classes.myVideo)} cover={true} classes={classes} style={{gridColumn: '4 / 5'}} stream={myVideoStream}>
                    <Fab onClick={muteClick} className={clsx(classes.mute, muted && classes.muted)}>
                        {muted ? <MicOffIcon/> : <MicIcon/>}
                    </Fab>
                </Video>
            </div>
        <ProfileDialog open={profileOpen} user={user} onClose={() => setProfileOpen(false)}/>
    </Container>;
}

export default connect(state => ({
    rtcStarted: state.rtcStarted,
    user: state.user,
    conducting: state.conducting,
    muted: state.muted,
    speaker: state.speaker,
    speaking: state.speaking,
}))(Main);