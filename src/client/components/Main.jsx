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
import SupervisorAccountIcon from '@material-ui/icons/SupervisorAccount';
import MusicNoteIcon from "@material-ui/icons/MusicNote";
import QueueMusicIcon from "@material-ui/icons/QueueMusic";
import ClearAllIcon from "@material-ui/icons/ClearAll";
import Button from "@material-ui/core/Button";
import ButtonGroup from "@material-ui/core/ButtonGroup";
import {useEffect, useRef, useState} from "react";
import Sidebar from "./Sidebar";
import ProfileDialog from "./dialogs/Profile";
import Lyrics from "./Lyrics";
import Transport from "./Transport";

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
        gridTemplateColumns: [['minmax(min-content, 300px)','auto']],
        gridTemplateRows: [['1fr', 'minmax(min-content,200px)']],
    }),
    gridItem: {

    },
    navButton: {
        margin: [[0, 10]],
    },
    myVideo: {
        width: 300,
    },
    mainPanelVideoHolder: {
        position: 'relative',
    },
    mainPanelVideo: {
        height: "100%",
        display: "block",
        margin: [[0, 'auto']],
    }
}));

const Grow = () => <div style={{flexGrow: 1}}/>;

const Video = ({stream, ...props}) => {
    let ref = useRef(null);

    useEffect(() => {
        if (ref.current && stream) {
            console.log("Setting stream");
            ref.current.srcObject = stream;
        }
    }, [ref.current, stream]);

    return <video autoPlay={true} ref={ref} {...props} />

};

const Main = ({rtcStarted, user}) => {
    let classes = useStyles({
        sidebarWidth: 400,
        myVideoAspectRatio: 3/2,
    });

    let [selectedPanel, setSelectedPanel] = useState('choir');
    let [profileOpen, setProfileOpen] = useState(false);

    useEffect(() => {
        if (user && !user?.name) {
            setProfileOpen(true);
        }
    }, [user?.name]);

    let [conductorVideoStream, setConductorVideoStream] = useState(null);
    let [choirVideoStream, setChoirVideoStream] = useState(null);


    let mainPanel = <div/>;

    switch(selectedPanel) {
        case 'conductor':
            mainPanel = <div className={classes.mainPanelVideoHolder}><Video className={classes.mainPanelVideo} stream={conductorVideoStream}/></div>;
            break;
        case 'choir':
            mainPanel = <div className={classes.mainPanelVideoHolder}><Video className={classes.mainPanelVideo} stream={choirVideoStream}/></div>;
            break;
        case 'score':
            mainPanel = <Paper>Score</Paper>;
            break;
        case 'lyrics':
            mainPanel = <Lyrics />;
            break;
        case 'tracks':
            mainPanel = <Paper>Tracks</Paper>;
            break;
    }

    let [myVideoStream, setMyVideoStream] = useState(null);
    useEffect(() => {
        if (rtcStarted) {
            setMyVideoStream(new MediaStream([window.rtcTracks.myVideo]));
            setChoirVideoStream(new MediaStream([window.rtcTracks.choirVideo, window.rtcTracks.speakerAudio]));
            setConductorVideoStream(new MediaStream([window.rtcTracks.conductorVideo, window.rtcTracks.conductorAudio]))
        }
    },[rtcStarted])

    return <Container className={clsx(classes.rootContainer)} maxWidth={false} disableGutters={true}>
        <AppBar>
            <Toolbar>
                <Typography variant="h6" className={classes.title}>Virtual Choir</Typography>
                <Grow/>
                <Button onClick={() => setSelectedPanel('conductor')} className={classes.navButton} color={'inherit'} startIcon={<EmojiPeopleIcon/>}>Conductor</Button>
                <Button onClick={() => setSelectedPanel('choir')} className={classes.navButton} color={'inherit'} startIcon={<SupervisorAccountIcon/>}>Choir</Button>
                <Button onClick={() => setSelectedPanel('score')} className={classes.navButton} color={'inherit'} startIcon={<MusicNoteIcon/>}>Score</Button>
                <Button onClick={() => setSelectedPanel('lyrics')} className={classes.navButton} color={'inherit'} startIcon={<QueueMusicIcon/>}>Lyrics</Button>
                <Button onClick={() => setSelectedPanel('tracks')} className={classes.navButton} color={'inherit'} startIcon={<ClearAllIcon/>}>Tracks</Button>
            </Toolbar>
        </AppBar>
        <div className={classes.appBarOffset}/>
            <div className={classes.grid}>
                <Sidebar/>
                {mainPanel}
                <Video className={classes.myVideo} stream={myVideoStream}/>
                <Transport/>
            </div>
        <ProfileDialog open={profileOpen} user={user} onClose={() => setProfileOpen(false)}/>
    </Container>;
}

export default connect(state => ({
    rtcStarted: state.rtcStarted,
    user: state.user,
}))(Main);