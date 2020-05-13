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
import format from "format-duration";
import grey from "@material-ui/core/colors/grey";
import blueGrey from "@material-ui/core/colors/blueGrey";
import {deleteItem, deleteLane, seek, updateLane} from "../../actions/audioActions";
import IconButton from "@material-ui/core/IconButton";
import DeleteIcon from "@material-ui/icons/Delete";
import Menu from "@material-ui/core/Menu";
import MenuItem from "@material-ui/core/MenuItem";
import VolumeOffIcon from '@material-ui/icons/VolumeOff';
import VolumeUpIcon from '@material-ui/icons/VolumeUp';
import Grid from "@material-ui/core/Grid";
import LinearProgress from "@material-ui/core/LinearProgress";
import FiberManualRecordIcon from "@material-ui/icons/FiberManualRecord";
import PlayArrowIcon from "@material-ui/icons/PlayArrow";
import PauseIcon from "@material-ui/icons/Pause";
import {green, red} from "@material-ui/core/colors";
import LaneHeader from "./LaneHeader";
import {setRehearsalState} from "../../actions";
import {confirm} from "../../util";

let useStyles = makeStyles(theme => ({
    root: {
        minHeight: 0,
        overflowY: 'hidden',
        overflowX: 'hidden',
        position: "relative",
        display: 'flex',
        flexDirection: 'column',
    },
    tracks: {
        flexGrow: 1,
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
    disabledHeader: {
        opacity: 0.5,
        backgroundColor: grey[200],
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
        //width: ({zoom, endTime}) => zoom*endTime,
        //left: ({zoom, rangeStart}) => -zoom*rangeStart + theme.spacing(1),
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
        //position: "sticky",
        //width: '100%',
        //bottom: 0,
        display: 'flex',
        backgroundColor: grey[200],
    },
    timeDisplay: ({sidebarWidth}) => ({
        //gridColumn: '1 / 2',
        width: sidebarWidth,
        textAlign: 'center',
        paddingTop: theme.spacing(1),
    }),
    timeScroll: {
        //gridColumn: '2 / 3',
        flexGrow:1,
        padding: theme.spacing(1),
    },
    cursor: {
        position: 'absolute',
        top: 0,
        height: "100%",
        width: 2,
        backgroundColor: theme.palette.primary[500],
        pointerEvents: 'none',
    },
    playbackVideo: {
        position: 'absolute',
        height: 'calc(100% - 8px)',
        top: 4,
        objectFit: 'fit',
        objectPosition: 'center',
        borderRadius: 8,
        transition: 'opacity 1s',
        zIndex: 10,
    },
    hidden: {
        opacity: 0,
    }
}));

const selectUserLanes = createSelector(state => ({
    users: state.users,
    lanes: state.lanes,
    items: state.items,
    user: state.user,
    transportState: state.transport.state,
    targetLaneId: state.targetLaneId,
    conductorUserId: state.room?.conductorUserId,
}), ({users, lanes, items, user, transportState, targetLaneId, conductorUserId}) => {
    let me = user;
    let r = [];
    // TODO: Sort users, sort lanes, sort items
    for (let [uid, user] of Object.entries(users || {})) {
        let userLanes = Object.values(lanes || {}).filter(lane => lane.userId === uid).map(lane => {
            return {
                items: Object.values(items || {}).filter(item => item.laneId === lane.laneId),
                originalLane: lane,
                ...lane
            };
        });

        let sends = Object.entries(user.state?.sending || {});
        let uploadProgress = null;
        if (sends.length > 0) {
            uploadProgress = 100 * sends[0][1].sentBytes / sends[0][1].totalBytes;
        }

        r.push({
            lanes: userLanes,
            uploadProgress,
            transportState: uid === me.userId ? transportState : user.state?.state,
            targetLaneId: uid === me.userId ? targetLaneId : user.state?.targetLaneId,
            conductor: uid === conductorUserId,
            ...user,
        });
    }

    r.sort((a,b) => {
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

const Item = ({classes, lane, item, zoom, itemRightClick, transportTime}) => {
    let videoRef = useRef(null);

    useEffect(() => {
        if (videoRef.current) {
            if (transportTime > item.startTime && transportTime < item.startTime + item.duration) {
                videoRef.current.currentTime = transportTime - item.startTime;
                videoRef.current.play();
            } else {
                videoRef.current.pause();
                videoRef.current.currentTime = 0;
            }
        }
    },[transportTime > item.startTime]);

    return <React.Fragment>
        <Paper className={clsx(classes.item, lane.enabled || classes.disabledItem)}
               elevation={3}
               onContextMenu={e => itemRightClick(e, item)}
               style={{
                   left: zoom * item.startTime,
                   width: zoom * item.duration,
                   backgroundImage: `url(${item.rms})`,
                   backgroundSize: '100% 100%',
                   backgroundRepeat: 'no-repeat',
               }}/>
        <video className={clsx(classes.playbackVideo, (transportTime > item.startTime && transportTime < item.startTime + item.duration && lane.enabled) || classes.hidden)}
               ref={videoRef}
               src={item.videoUrl}
               autoPlay={true}
               style={{
                   right: `calc(100% - ${zoom * transportTime}px)`,
               }}
        />
    </React.Fragment>
}

let lastRange = null; // Ewww

let Tracks = ({className, users, endTime, sidebarWidth, dispatch, transportTime, conducting, rehearsalState}) => {

    let [itemContextMenu, setItemContextMenu] = useState(itemContextMenuInitialState);

    let [zoom, setZoom] = useState(10) // Pixels per second
    let [range, setRange] = useState(rehearsalState?.tracksZoomRange || [0, 0, 0]);
    lastRange = range;
    let timeSlider = useRef(null);

    useEffect(() => {
        if (!rehearsalState?.tracksZoomRange) {
            setRange([range[0], endTime / 2, endTime]);
        }
    }, [endTime]);

    useEffect(() => {
        if (timeSlider.current && endTime && range[2] > range[0]) {
            let newZoom = timeSlider.current.getBoundingClientRect().width / (range[2] - range[0]);
            setZoom(newZoom);
        }
    }, [endTime, range, timeSlider.current]);

    useEffect(() => {
        if (rehearsalState?.tracksZoomRange) {
            setRange(rehearsalState.tracksZoomRange.slice());
        }
    }, [rehearsalState?.tracksZoomRange]);

    let classes = useStyles({sidebarWidth/*, zoom, endTime, rangeStart: range[0]*/});

    let tracksClick = useCallback(e => {
        if (e.pageX > sidebarWidth) {
            dispatch(seek(Math.max(0, range[0] + ((e.pageX - sidebarWidth - 8) / zoom)), true, conducting))
        }
    });


    let slideIdleTimeout = useRef(null);
    let slide = v => {
        clearTimeout(slideIdleTimeout.current);
        if (conducting) {
            slideIdleTimeout.current = setTimeout(() => {
                dispatch(setRehearsalState({...rehearsalState, tracksZoomRange: lastRange}, true));
            }, 500);
        }

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
        <div className={classes.tracks} onClick={tracksClick}>
            {users.map((user,ui) => {

                return <React.Fragment key={`${ui}`}>
                    {user.lanes.map((lane, li) => {
                        let firstUserLane = li === 0;
                        let lastUserLane = user.targetLaneId && li === user.lanes.length - 1;
                        return <React.Fragment key={`${ui}-${li}`}>
                            <LaneHeader
                                className={clsx(classes.header, firstUserLane && classes.firstUserLane, lane.enabled || classes.disabledHeader)}
                                firstUserLane={firstUserLane} lastUserLane={lastUserLane} user={user} lane={lane}
                                laneIndex={li}/>
                            <div className={clsx(classes.lane, firstUserLane && classes.firstUserLane, lane.enabled || classes.disabledLane)}>
                                <div className={classes.laneInner}
                                     //onClick={laneClick}
                                     style={{
                                         width: zoom * endTime,
                                         left: -zoom * range[0] + 8,
                                     }}>
                                    {lane.items.map((item, ii) => <Item key={ii} classes={classes} lane={lane} item={item} zoom={zoom} itemRightClick={itemRightClick} transportTime={transportTime}/>)}
                                    </div>
                            </div>
                        </React.Fragment>
                    })}
                    {(user.targetLaneId === null || user.lanes.length === 0) && <><LaneHeader
                        className={clsx(classes.header, classes.firstUserLane)}
                        firstUserLane={user.lanes.length === 0} lastUserLane={true} user={user}/>
                    <div className={classes.lane}/></>}
                </React.Fragment>;
            })}
            {transportTime >= range[0] && transportTime <= range[2] && <div className={classes.cursor} style={{
                left: `calc(${sidebarWidth+8}px + ${zoom * (transportTime - range[0])}px)`
            }}/>}
        </div>
        <div className={classes.fixedBottomRow}>
            <div className={clsx(classes.timeDisplay)}>
                <Typography variant={"h6"} className={classes.timer}>{format(transportTime*1000)}{endTime && ` / ${format(endTime*1000)}`}</Typography>
            </div>
            <div className={clsx(classes.timeScroll)}>
                {endTime && <Slider ref={timeSlider} value={range} max={endTime} onChange={(e,v) => slide(v)}/>}
            </div>
        </div>
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
            <MenuItem onClick={async () => {closeItemContextMenu(); (await confirm(dispatch, 'Are you sure you want to delete this item?', 'Delete Item?')) && dispatch(deleteItem(itemContextMenu.item.itemId, conducting))}}>Delete Item</MenuItem>
        </Menu>
    </Paper>
}

export default connect(state => ({
    users: selectUserLanes(state),
    endTime: selectEndTime(state),
    transportTime: state.transport.currentTime,
    conducting: state.conducting,
    rehearsalState: state.rehearsalState,
}))(Tracks);