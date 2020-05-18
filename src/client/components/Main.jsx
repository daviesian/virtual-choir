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
import {muteChoir, requestSpeak, rtcMute, rtcUnmute} from "../actions/rtcActions";
import RecordVoiceOverIcon from '@material-ui/icons/RecordVoiceOver';
import Backdrop from "@material-ui/core/Backdrop";
import CircularProgress from "@material-ui/core/CircularProgress";
import {setRehearsalState} from "../actions";
import Modal from "./Modal";
import Score from "./Score";

const useStyles = makeStyles(theme => ({
    rootContainer: ({sidebarWidth, myVideoAspectRatio}) => ({
        height: "100%",
        display: 'grid',
        gridTemplateColumns: [[sidebarWidth,sidebarWidth,'auto',sidebarWidth]],
        gridTemplateRows: [['minmax(min-content,200px)', 'min-content', '1fr', ]],
        backgroundColor: '#cecece',
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
    appBarRow: {
        gridColumn: '1 / 5',
        gridRow: '2',
    },
    mainLeft: {
        gridColumn: '1',
        gridRow: '3',
    },
    mainRight: {
        gridColumn: '2 / 5',
        gridRow: '3',
    },
    mainRow: {
        gridColumn: '1 / 5',
        gridRow: '3',
    },
    conductorGridPos: {
        gridRow: '1',
    },
    choirGridPos: {
        gridColumn: '1',
        gridRow: '1',
    },
    controlsGridPos: {
        gridColumn: '2 / 5',
        gridRow: '1',
    },
    selfVideoGridPos: {
        gridColumn: '4',
        gridRow: '1',
    },
    tracks: {
        gridColumn: '1 / 3',
    },
    videoContainer: {
        position: 'relative',
        width: '100%',
        paddingTop: '67%',
    },
    video: {
        position: 'absolute',
        top:0, left: 0,
        width: '100%',
        height: '100%',
        display: 'block',
        objectPosition: 'center',
    },
    mirror: {
        transform: 'scaleX(-1)',
        transformOrigin: 'center',
    },
    cover: {
        objectFit: 'cover',
    },
    videoOverlay: {
        position: 'absolute',
        left: 0, top: 0,
        width: '100%',
        height: '100%',
    },
    mute: {
        margin: theme.spacing(2),
        backgroundColor: green[100],
        color: green[900],
    },
    muteChoir: {
        float: 'right',
        margin: theme.spacing(2),
        backgroundColor: green[100],
        color: green[900],
    },
    muted: {
        backgroundColor: red[100],
        color: red[900],
    },
    extendedIcon: {
        marginRight: theme.spacing(1)
    },
    backdrop: {
        zIndex: 9999,
        color: "white",
        flexDirection: 'column',
    }
}));

const Grow = () => <div style={{flexGrow: 1}}/>;

const Video = ({stream, className, classes, muted, cover, children, mirror, ...props}) => {
    let ref = useRef(null);

    useEffect(() => {
        if (ref.current && stream) {
            ref.current.srcObject = stream;
        }
    }, [ref.current, stream]);

    return <div className={clsx(className, classes.videoContainer)} {...props}>
        <video className={clsx(classes.video, cover && classes.cover, mirror && classes.mirror)} autoPlay={true} ref={ref} muted={muted}/>
        <div className={classes.videoOverlay}>
            {children}
        </div>
    </div>;
};

const Main = ({rtcStarted, user, conducting, muted, speaker, speaking, lyrics, score, loading, loadingMessage, loadingProgress, rehearsalState, modals, dispatch}) => {
    const sidebarWidth = 300;

    let classes = useStyles({
        sidebarWidth,
    });

    let [selectedPanel, setSelectedPanel] = useState(rehearsalState?.mainPanel || 'tracks');
    let [profileOpen, setProfileOpen] = useState(false);

    let choosePanel = useCallback(panel => {
        setSelectedPanel(panel);
        if (conducting) {
            dispatch(setRehearsalState({...rehearsalState, mainPanel: panel}, true));
        }
    });

    useEffect(() => {
        if(rehearsalState?.mainPanel && selectedPanel !== rehearsalState?.mainPanel) {
            setSelectedPanel(rehearsalState.mainPanel);
        }
    }, [rehearsalState.mainPanel]);

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
            mainPanel = <div className={clsx(classes.mainPanelVideoHolder, classes.mainRight)}><Video className={classes.mainPanelVideo} classes={classes} muted={true} stream={conductorVideoStream}/></div>;
            break;
        case 'choir':
            mainPanel = <div className={clsx(classes.mainPanelVideoHolder, classes.mainRight)}><Video className={classes.mainPanelVideo} classes={classes} muted={true} stream={choirVideoStream}/></div>;
            break;
        case 'score':
            mainPanel = <Score className={classes.mainRight}>Score</Score>;
            break;
        case 'lyrics':
            mainPanel = <Lyrics className={classes.mainRight}/>;
            break;
        case 'tracks':
            mainPanel = <Tracks sidebarWidth={sidebarWidth} className={classes.mainRow}/>;
            break;
    }

    let muteClick = useCallback(() => {
        if (conducting) {
            dispatch(muted ? rtcUnmute() : rtcMute());
        } else {
            dispatch(requestSpeak(!speaking))
        }
    });

    let muteChoirClick = useCallback(() => {
        if (conducting) {
            dispatch(muteChoir());
        }
    });

    muted = (conducting && muted) || (!conducting && !speaking);

    return <Container className={clsx(classes.rootContainer)} maxWidth={false} disableGutters={true}>
        {selectedPanel !== 'tracks' && <Sidebar className={classes.topLeft}/>}
        {mainPanel}
        <Video className={clsx(classes.conductorGridPos, classes.myVideo, conducting && classes.mirror)} cover={true} classes={classes} style={{gridColumn: '1 / 2'}} stream={conducting ? myVideoStream : conductorVideoStream}/>
        <Video className={clsx(classes.choirGridPos, classes.myVideo)} cover={true} classes={classes} style={{gridColumn: '2 / 3'}} stream={choirVideoStream}>
            {speaker && <Fab onClick={muteChoirClick} className={clsx(classes.muteChoir, !speaker && classes.muted)} size={'small'} variant={'extended'}>
                <MicIcon className={classes.extendedIcon}/>
                {speaker.name}
            </Fab>}
        </Video>
        <Transport className={classes.controlsGridPos} style={{gridColumn: '3 / 4'}}/>
        <Video className={clsx(classes.selfVideoGridPos, classes.myVideo)} mirror={true} cover={true} classes={classes} stream={myVideoStream}>
            <Fab onClick={muteClick} className={clsx(classes.mute, muted && classes.muted)}>
                {muted ? <MicOffIcon/> : <MicIcon/>}
            </Fab>
        </Video>
        <AppBar className={classes.appBarRow} position={'relative'}>
            <Toolbar>
                <Typography variant="h6" className={classes.title}>Virtual Choir</Typography>
                <Grow/>
                {!conducting && <Button onClick={() => choosePanel('conductor')} className={classes.navButton} color={'inherit'} startIcon={<EmojiPeopleIcon/>}>Conductor</Button>}
                <Button onClick={() => choosePanel('choir')} className={classes.navButton} color={'inherit'} startIcon={<SupervisorAccountIcon/>}>Choir</Button>
                <Button onClick={() => choosePanel('score')} disabled={false} className={classes.navButton} color={'inherit'} startIcon={<MusicNoteIcon/>}>Score</Button>
                <Button onClick={() => choosePanel('lyrics')} disabled={!conducting && !lyrics} className={classes.navButton} color={'inherit'} startIcon={<QueueMusicIcon/>}>Lyrics</Button>
                <Button onClick={() => choosePanel('tracks')} className={classes.navButton} color={'inherit'} startIcon={<ClearAllIcon/>}>Tracks</Button>
            </Toolbar>
        </AppBar>
        <ProfileDialog open={profileOpen} user={user} onClose={() => setProfileOpen(false)}/>
        {modals.map((m,mi) => <Modal key={mi} spec={m}/>)}
        <Backdrop className={classes.backdrop} open={loading > 0} timeout={{enter: 1000, exit: 100}}>
            <CircularProgress color={'inherit'} variant={loadingProgress ? 'determinate' : 'indeterminate'} value={loadingProgress ? (100 * loadingProgress.progress / loadingProgress.maximum) : 0}/>
            <Typography variant={'caption'} color={'inherit'} style={{marginTop: 8}}>{loadingMessage}</Typography>
        </Backdrop>
    </Container>;
}

export default connect(state => ({
    rtcStarted: state.rtcStarted,
    user: state.user,
    conducting: state.conducting,
    muted: state.muted,
    speaker: state.speaker,
    speaking: state.speaking,
    lyrics: state.lyrics[state.project?.lyricsUrl],
    score: state.scores[state.project?.scoreUrl],
    loading: state.loading,
    loadingMessage: state.loadingMessage,
    loadingProgress: state.loadingProgress,
    rehearsalState: state.rehearsalState,
    modals: state.modals,
}))(Main);