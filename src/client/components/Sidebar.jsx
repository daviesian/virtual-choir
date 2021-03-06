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
import Paper from "@material-ui/core/Paper";
import ListSubheader from "@material-ui/core/ListSubheader";
import Divider from "@material-ui/core/Divider";
import Badge from "@material-ui/core/Badge";

const useStyles = makeStyles(theme => ({
    root: {
        minHeight: 0,
        overflowY: 'auto',
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
    online: {
    }
}));

let Sidebar = ({className, users, user, conductorUserId, dispatch}) => {

    let classes = useStyles();

    let singerList = Object.entries(users)/*.filter(([userId, u]) => userId !== user?.userId)*/.map(([userId, u]) => {
        let s = {...u};
        let sends = Object.entries(s.state?.sending || {});
        s.uploadProgress = null;
        if (sends.length > 0) {
            s.uploadProgress = 100 * sends[0][1].sentBytes / sends[0][1].totalBytes;
        }
        return s;
    });

    singerList.sort((a,b) => {
        if (a.user.userId === conductorUserId) {
            return -1;
        } else if (b.user.userId === conductorUserId) {
            return 1;
        } else if (a.user.userId === user.userId) {
            return -1;
        } else if (b.user.userId === user.userId) {
            return 1;
        } else if (a.online && !b.online) {
            return -1;
        } else if (b.online && !a.online) {
            return 1;
        } else if (a.user.name < b.user.name) {
            return -1;
        } else {
            return 1;
        }
    });


    return <Paper elevation={0} square className={clsx(className, classes.root)}>
        <List>
            {singerList.map(singer => <div key={singer.user.userId}>
                <ListItem>
                    {<ListItemAvatar>
                        <Avatar className={clsx({
                            [classes.play]: singer.state?.state === 'playing' && singer.state?.state !== 'recording',
                            [classes.record]: singer.state?.state === 'recording',
                            [classes.pause]: singer.state?.state !== 'playing' && singer.state?.state !== 'recording',
                        })}>
                            {singer.state === 'recording' ? <FiberManualRecordIcon/> : singer.state?.state === 'playing' ? <PlayArrowIcon/> : <PauseIcon/>}
                        </Avatar>
                    </ListItemAvatar>}

                        <ListItemText primary={`${singer.user.name} ${ singer.online || singer.user.userId === user?.userId || singer.user.userId === conductorUserId ? '' : '(Offline)'}`} secondary={`${singer.user?.voice || 'Singer'}`}/>

                    <CircularProgress size={50} className={classes.uploadProgress} variant="static" value={singer.uploadProgress}/>
                </ListItem>
                <Divider/>
                </div>)
            }

        </List>
    </Paper>;
}

export default connect(state => ({
    users: state.users,
    conductorUserId: state.room?.conductorUserId,
    user: state.user,
}))(Sidebar);