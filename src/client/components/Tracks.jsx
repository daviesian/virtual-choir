import * as React from 'react';
import {connect} from "react-redux";
import Paper from "@material-ui/core/Paper";
import makeStyles from "@material-ui/core/styles/makeStyles";
import clsx from "clsx";
import {createSelector} from "reselect";
import List from "@material-ui/core/List";
import ListItem from "@material-ui/core/ListItem";
import {useCallback, useEffect, useRef, useState} from "react";
import purple from "@material-ui/core/colors/purple";
import teal from "@material-ui/core/colors/teal";
import Typography from "@material-ui/core/Typography";
import Slider from "@material-ui/core/Slider";
import ZoomSlider from "./ZoomSlider";
import format from "format-duration";
import grey from "@material-ui/core/colors/grey";
import blueGrey from "@material-ui/core/colors/blueGrey";
import TransportCursor from "./TransportCursor";
import {deleteItem, deleteLane, seek, updateLane} from "../actions/audioActions";
import IconButton from "@material-ui/core/IconButton";
import DeleteIcon from "@material-ui/icons/Delete";
import Menu from "@material-ui/core/Menu";
import MenuItem from "@material-ui/core/MenuItem";
import VolumeOffIcon from '@material-ui/icons/VolumeOff';
import VolumeUpIcon from '@material-ui/icons/VolumeUp';
import Grid from "@material-ui/core/Grid";

let useStyles = makeStyles(theme => ({
    root: {
        minHeight: 0,
        overflowY: 'hidden',
        overflowX: 'hidden',
        position: "relative",
    },
    tracks: {
        height: '100%',
        overflowY: 'auto',
        overflowX: 'hidden',
        backgroundColor: grey[50],
        display: 'grid',
        gridTemplateColumns: ({sidebarWidth}) => [[sidebarWidth, '1fr']],
        //gridAutoRows: 'minmax(70px, min-content)',
        alignContent: 'start',
    },
    header: {
        gridColumn: '1 / 2',
        position: "relative",
        borderTop: [["1px solid", blueGrey[100]]],
        padding: theme.spacing(1),
    },
    headerRight: {
        textAlign: 'right',
    },
    disabledHeader: {
        opacity: 0.5,
        backgroundColor: grey[200],
    },
    laneName: {
        marginRight: theme.spacing(1),
    },
    laneUser: {

    },
    lane: {
        gridColumn: '2 / 3',
        backgroundColor: blueGrey[200],
        overflow: 'hidden',
        position: 'relative',
        cursor: 'text',
        borderTop: [["1px solid", blueGrey[300]]],
        minHeight: 70,
    },
    laneInner: {
        height: '100%',
        position: 'absolute',
        top: 0,
        width: ({zoom, endTime}) => zoom*endTime,
        left: ({zoom, rangeStart}) => -zoom*rangeStart + theme.spacing(1),
    },
    disabledLane: {
        backgroundColor: blueGrey[400],
    },
    item: {
        position: 'absolute',
        height: "calc(100% - 10px)",
        top: 5,
        cursor: 'default',
        '&:hover': {
            backgroundColor: grey[100],
        }
    },
    disabledItem: {
        backgroundColor: grey[500],
    },
    firstUserLane: {
        borderTop: [["2px solid", blueGrey[300]]],
    },
    fixedBottomRow: {
        position: "sticky",
        width: '100%',
        bottom: 0,
        backgroundColor: grey[200],
    },
    timeDisplay: {
        gridColumn: '1 / 2',
        textAlign: 'center',
        paddingTop: theme.spacing(2),
    },
    timeScroll: {
        gridColumn: '2 / 3',
        padding: theme.spacing(1),
    },
    cursor: {
        position: 'absolute',
        top: 0,
        height: "100%",
        width: 2,
        backgroundColor: theme.palette.primary[500],
        pointerEvents: 'none',
    }
}));

const selectUserLanes = createSelector(state => ({
    users: state.users,
    lanes: state.lanes,
    items: state.items,
    user: state.user,
}), ({users, lanes, items, user}) => {
    let r = [];
    // TODO: Sort users, sort lanes, sort items
    for (let [uid, user] of Object.entries(users || {})) {
        let userLanes = Object.values(lanes || {}).filter(lane => lane.userId === uid).map(lane => {
            return {
                items: Object.values(items || {}).filter(item => item.laneId === lane.laneId),
                ...lane
            };
        });
        r.push({
            lanes: userLanes,
            targetLane: userLanes[0], // Can quite happily be undefined
            ...user,
        });
    }
    r.sort((a,b) => {
        if (a.user.userId === user.userId) {
            return -1;
        } else if (b.user.userId === user.userId) {
            return 1;
        } else if (a.user.name < b.user.name) {
            return -1;
        } else {
            return 1;
        }
    })
    return r;
});

const selectEndTime = createSelector(state => state.items, items => {
    let endTime = null;
    for (let item of Object.values(items || {})) {
        endTime = Math.max(endTime, item.startTime + item.duration);
    }
    return endTime;
});

const Lane = ({user, lane, classes}) => {
    return <ListItem>

    </ListItem>;
};

const UserLanes = ({user, classes}) => {
    return <List>
        {user.lanes.map((lane,i) => <Lane key={i} user={user} lane={lane} firstLane={i===0} classes={classes}/>)}
    </List>;
};

let itemContextMenuInitialState = {
    mouseX: null,
    mouseY: null,
    item: null,
}


let Tracks = ({className, users, endTime, sidebarWidth, dispatch, transportTime, conducting}) => {

    let [itemContextMenu, setItemContextMenu] = useState(itemContextMenuInitialState);

    let [zoom, setZoom] = useState(10) // Pixels per second
    let [range, setRange] = useState([0, 0, 0]);
    let timeSlider = useRef(null);

    useEffect(() => {
        setRange([range[0], endTime / 2, endTime]);
    }, [endTime]);

    useEffect(() => {
        if (timeSlider.current && endTime && range[2] > range[0]) {
            let newZoom = timeSlider.current.getBoundingClientRect().width / (range[2] - range[0]);
            setZoom(newZoom);
        }
    }, [endTime, range, timeSlider.current]);

    let classes = useStyles({sidebarWidth, zoom, endTime, rangeStart: range[0]});

    let laneClick = useCallback(e => {
        dispatch(seek(range[0] + ((e.pageX - sidebarWidth)/zoom), true, conducting))
    });

    let slide = v => {
        if (v[1] !== range[1]) {
            // Adjust position
            let dt = v[1]-range[1];
            dt = Math.min(dt, endTime - range[2]);
            dt = Math.max(dt, -range[0]);
            setRange([range[0] + dt, range[1] + dt, range[2] + dt]);
        } else {
            // Adjust zoom
            setRange([v[0], v[0]+(v[2]-v[0])/2, v[2]]);
        }
    };

    let itemRightClick = useCallback((e,item) => {
        setItemContextMenu({
            mouseX: e.clientX,
            mouseY: e.clientY,
            item,
        });
        e.preventDefault();
    });

    let closeItemContextMenu = useCallback(() => {
        setItemContextMenu(itemContextMenuInitialState);
    });

    return <Paper square elevation={0} className={clsx(classes.root, className)}>
        <div className={classes.tracks}>
            {users.map((user,ui) => user.lanes.map((lane,li) => {
                let firstUserLane = li === 0;
                return <React.Fragment key={`${ui}-${li}`}>
                    <Grid container className={clsx(classes.header, firstUserLane && classes.firstUserLane, lane.enabled || classes.disabledHeader)}>
                        <Grid item xs>
                            {firstUserLane && <Typography variant={"h6"} className={classes.laneUser}>{user.user.name}</Typography>}
                        </Grid>
                        <Grid item xs className={classes.headerRight}>
                            <Typography className={classes.laneName} variant={"body1"}>{lane.name || `${user.user.name} ${li+1}`}</Typography>
                            <IconButton size={'small'} onClick={() => dispatch(deleteLane(lane.laneId, conducting))}><DeleteIcon/></IconButton>
                            <IconButton size={'small'} onClick={() => dispatch(updateLane({...lane, enabled: !lane.enabled}, null, null, conducting))}>
                                {lane.enabled ? <VolumeUpIcon/> : <VolumeOffIcon/>}
                            </IconButton>
                        </Grid>
                    </Grid>
                    <div className={clsx(classes.lane, firstUserLane && classes.firstUserLane, lane.enabled || classes.disabledLane)}>
                        <div className={classes.laneInner} onClick={laneClick}>
                            {lane.items.map((item, ii) => <Paper key={ii}
                                                                 className={clsx(classes.item, lane.enabled || classes.disabledItem)}
                                                                 elevation={3}
                                                                 onContextMenu={e => itemRightClick(e, item)}
                                                                 style={{
                                                                     left: zoom*item.startTime,
                                                                     width: zoom*item.duration,
                                                                     backgroundImage: `url(${item.rms})`,
                                                                     backgroundSize: '100% 100%',
                                                                     backgroundRepeat: 'no-repeat',
                                                                 }}/>)}
                        </div>
                    </div>
                </React.Fragment>}))}
            <div className={clsx(classes.fixedBottomRow, classes.timeDisplay)}>
                <Typography variant={"h6"} className={classes.timer}>{format(transportTime*1000)}{endTime && ` / ${format(endTime*1000)}`}</Typography>
            </div>
            <div className={clsx(classes.fixedBottomRow, classes.timeScroll)}>
                {endTime && <Slider ref={timeSlider} value={range} max={endTime} onChange={(e,v) => slide(v)}/>}
            </div>
        </div>
        {transportTime >= range[0] && transportTime <= range[2] && <div className={classes.cursor} style={{
            left: `calc(${sidebarWidth+8}px + ${zoom * (transportTime - range[0])}px)`
        }}/>}
        <Menu
            keepMounted
            open={itemContextMenu.mouseY !== null}
            onClose={closeItemContextMenu}
            anchorReference="anchorPosition"
            anchorPosition={
                itemContextMenu.mouseY !== null && itemContextMenu.mouseX !== null
                    ? { top: itemContextMenu.mouseY, left: itemContextMenu.mouseX }
                    : undefined
            }
        >
            <MenuItem onClick={() => {closeItemContextMenu(); dispatch(deleteItem(itemContextMenu.item.itemId, conducting))}}>Delete Item</MenuItem>
        </Menu>
    </Paper>
}

export default connect(state => ({
    users: selectUserLanes(state),
    endTime: selectEndTime(state),
    transportTime: state.transport.currentTime,
    conducting: state.conducting,
}))(Tracks);