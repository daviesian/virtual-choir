import * as React from "react";
import clsx from "clsx";
import {connect} from "react-redux";

import Grid from "@material-ui/core/Grid";
import Typography from "@material-ui/core/Typography";
import FiberManualRecordIcon from "@material-ui/icons/FiberManualRecord";
import PlayArrowIcon from "@material-ui/icons/PlayArrow";
import PauseIcon from "@material-ui/icons/Pause";
import LinearProgress from "@material-ui/core/LinearProgress";
import IconButton from "@material-ui/core/IconButton";
import {deleteLane, targetLane, updateLane} from "../../actions/audioActions";
import DeleteIcon from "@material-ui/icons/Delete";
import StarIcon from "@material-ui/icons/Star";
import StarBorderIcon from "@material-ui/icons/StarBorder";
import VolumeUpIcon from "@material-ui/icons/VolumeUp";
import VolumeOffIcon from "@material-ui/icons/VolumeOff";
import CloudOffIcon from "@material-ui/icons/CloudOff";
import AddIcon from "@material-ui/icons/Add";
import makeStyles from "@material-ui/core/styles/makeStyles";
import {green, red} from "@material-ui/core/colors";
import grey from "@material-ui/core/colors/grey";
import EmojiPeopleIcon from "@material-ui/icons/EmojiPeople";
import CloudUploadIcon from '@material-ui/icons/CloudUpload';
import {useCallback, useEffect, useRef} from "react";
import {uploadItem} from "../../actions";
import Button from "@material-ui/core/Button";
import Toolbar from "@material-ui/core/Toolbar";
import {confirm} from "../../util";

let useStyles = makeStyles(theme => ({
    laneUser: {

    },
    play: {
        color: green[500],
        verticalAlign: 'text-bottom',
    },
    record: {
        color: red[500],
        verticalAlign: 'text-bottom',
    },
    pause: {
        color: grey[500],
        verticalAlign: 'text-bottom',
    },
    offline: {
        color: grey[400],
        verticalAlign: 'text-bottom',
        marginRight: theme.spacing(1),
    },
    laneName: {
        marginRight: theme.spacing(1),
    },
    headerRight: {
        textAlign: 'right',
    },
    addLane: {
        position: 'absolute',
        left: 6,
        bottom: 0,
    },
    uploadIcon: {
        verticalAlign: 'text-bottom',
        marginLeft: theme.spacing(1),
        color: grey[500],
        cursor: 'pointer',
        '&:hover': {
            color: grey[900],
        }
    }
}));

let LaneHeader = ({className, firstUserLane, lastUserLane, user, lane, laneIndex, conducting, conductorUserId, dispatch}) => {

    let classes = useStyles();

    return  <Grid container className={className}>
        <Grid item xs>
            {firstUserLane && <Typography variant={"h6"} className={classes.laneUser}>
                {!user.online ? <CloudOffIcon className={classes.offline}/> :
                user.transportState === 'recording' ? <FiberManualRecordIcon className={classes.record}/> : user.transportState === 'playing' ? <PlayArrowIcon className={classes.play}/> : <PauseIcon className={classes.pause}/>}
                {user.user.name}
                {conducting && user.user.userId === conductorUserId && <>
                    <input
                        accept="audio/*"
                        style={{ display: 'none' }}
                        id="file-upload-thing"
                        type="file"
                        onChange={e => dispatch(uploadItem(e.target.files[0]))}
                    />
                    <label htmlFor="file-upload-thing">
                        <CloudUploadIcon className={classes.uploadIcon} fontSize={'small'}/>
                    </label>
                </>}
            </Typography>}
            {firstUserLane && user.uploadProgress && <LinearProgress variant={"determinate"} value={user.uploadProgress}/>}

        </Grid>
        <Grid item xs className={classes.headerRight}>
            {lane && <>
                <Typography className={classes.laneName} variant={"body1"}>{lane.name || `${user.user.name} ${laneIndex+1}`}</Typography>
                {user.online && lastUserLane && <IconButton size={'small'} onClick={() => dispatch(targetLane(user.user.userId, null, conducting))}><AddIcon/></IconButton>}
                <IconButton size={'small'} onClick={async () => (await confirm(dispatch, 'Are you sure you want to delete this lane and all its clips?', 'Delete Lane?')) && dispatch(deleteLane(lane.laneId, conducting))}><DeleteIcon/></IconButton>
                <IconButton size={'small'} onClick={() => dispatch(updateLane({...lane.originalLane, enabled: !lane.enabled}, null, null, conducting))}>
                    {lane.enabled ? <VolumeUpIcon/> : <VolumeOffIcon/>}
                </IconButton>
            </>}
            {user.online && <IconButton size={'small'} onClick={() => lane && dispatch(targetLane(user.user.userId, lane.laneId, conducting))}>
                {lane?.laneId == user.targetLaneId ? <StarIcon/> : <StarBorderIcon/>}
            </IconButton>}
        </Grid>
    </Grid>
}

export default connect(state => ({
    conducting: state.conducting,
    conductorUserId: state.room?.conductorUserId,
}))(LaneHeader);