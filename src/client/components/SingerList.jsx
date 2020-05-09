import * as React from "react";
import {connect} from "react-redux";
import Toolbar from "@material-ui/core/Toolbar";
import List from "@material-ui/core/List";
import ListItem from "@material-ui/core/ListItem";
import Drawer from "@material-ui/core/Drawer";
import {makeStyles} from "@material-ui/core/styles";
import ListItemText from "@material-ui/core/ListItemText";
import ListItemAvatar from "@material-ui/core/ListItemAvatar";
import Avatar from "@material-ui/core/Avatar";
import PlayArrowIcon from "@material-ui/icons/PlayArrow";
import PauseIcon from '@material-ui/icons/Pause';
import FiberManualRecordIcon from '@material-ui/icons/FiberManualRecord';
import { green, red } from '@material-ui/core/colors';
import clsx from "clsx";
import {CircularProgress} from "@material-ui/core";

const DRAWER_WIDTH = 240;

const useStyles = makeStyles(theme => ({
    drawer: {
        position: 'relative',
        width: DRAWER_WIDTH,
        flexShrink: 0,
    },

    drawerPaper: {
        width: DRAWER_WIDTH,
    },
    play: {
        color: 'white',
        backgroundColor: green[500],
    },
    record: {
        color: 'white',
        backgroundColor: red[500],
    },
    pause: {
        color: 'white'
    },
    uploadProgress: {
        position: 'absolute',
        marginLeft: -5,
    },
}));

let SingerList = ({open, users, user, dispatch}) => {

    if (!user) {
        return null;
    }

    let classes = useStyles();

    let singerList = Object.entries(users).filter(([userId, user]) => userId !== user.userId).map(([userId, user]) => {
        let s = {...user};
        let sends = Object.entries(s.state?.sending || {});
        s.uploadProgress = null;
        if (sends.length > 0) {
            s.uploadProgress = 100 * sends[0][1].sentBytes / sends[0][1].totalBytes;
        }
        return s;
    });

    return <Drawer open={open} anchor='left' className={classes.drawer} variant='persistent'  classes={{paper: classes.drawerPaper}}>
        <Toolbar/> {/* Spacing underneath the AppBar */}
        <List>
            Hello
            {singerList.map(singer =>
                <ListItem key={singer.user.userId}>
                    {<ListItemAvatar>
                        <Avatar className={clsx({
                            [classes.play]: singer.state?.playing && !singer.state?.recording,
                            [classes.record]: singer.state?.recording,
                            [classes.pause]: !singer.state?.playing && !singer.state?.recording,
                        })}>
                            {singer.state?.recording ? <FiberManualRecordIcon/> : singer.state?.playing ? <PlayArrowIcon/> : <PauseIcon/>}
                        </Avatar>
                    </ListItemAvatar>}
                    <ListItemText primary={singer.user.name} secondary={`${singer.user?.voice || 'Singer'}`}/>
                    <CircularProgress size={50} className={classes.uploadProgress} variant="static" value={singer.uploadProgress}/>
                </ListItem>)
            }

        </List>
    </Drawer>;
}

export default connect(state => ({
    users: state.users,
    user: state.user,
}))(SingerList);