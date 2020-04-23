import * as React from "react";
import {connect} from "react-redux";

import Dialog from "@material-ui/core/Dialog";
import DialogTitle from "@material-ui/core/DialogTitle";
import DialogContent from "@material-ui/core/DialogContent";
import DialogActions from "@material-ui/core/DialogActions";
import Button from "@material-ui/core/Button";
import Typography from "@material-ui/core/Typography";
import TextField from "@material-ui/core/TextField";
import {makeStyles} from "@material-ui/core/styles";
import {useCallback, useEffect, useRef, useState} from "react";
import {updateUser} from "../../actions";

let useStyles = makeStyles(theme => ({
    spaced: {
        margin: [[theme.spacing(2), 0]],
    }
}));


const ProfileDialog = ({open, onClose, user, dispatch}) => {

    let classes = useStyles();

    let [name, setName] = useState(user?.name || '');

    let join = useCallback(() => {
        if (name) {
            dispatch(updateUser({name}));
            onClose();
        }
    });

    return <Dialog open={open} onClose={onClose} disableBackdropClick={true} disableEscapeKeyDown={true}>
        <DialogTitle>
            Welcome!
        </DialogTitle>
        <DialogContent>
            <Typography variant="body1">To get started, tell us who you are</Typography>
            <TextField value={name} onChange={e => setName(e.target.value)} onKeyPress={e => e.key === 'Enter' && join()} autoFocus={true} className={classes.spaced} label="Your name" fullWidth={true}/>
        </DialogContent>
        <DialogActions>
             <Button variant="contained" color="primary" disabled={!name} onClick={join}>Join Rehearsal</Button>
        </DialogActions>
    </Dialog>
};

export default connect()(ProfileDialog);