import Dialog from "@material-ui/core/Dialog";
import DialogTitle from "@material-ui/core/DialogTitle";
import DialogContent from "@material-ui/core/DialogContent";
import DialogActions from "@material-ui/core/DialogActions";
import Button from "@material-ui/core/Button";
import * as React from "react";
import {connect} from "react-redux";
import List from "@material-ui/core/List";
import ListItem from "@material-ui/core/ListItem";
import ListItemIcon from "@material-ui/core/ListItemIcon";
import MicIcon from '@material-ui/icons/Mic';
import SpeakerIcon from '@material-ui/icons/Speaker';
import SpeakerOutlinedIcon from '@material-ui/icons/Speaker';
import ListItemText from "@material-ui/core/ListItemText";
import Divider from "@material-ui/core/Divider";
import {initDevices, selectInputDevice, selectOutputDevice} from "../../actions/audioActions";
import {useEffect} from "react";

let DeviceSelectionDialog = ({open, onClose, devices, dispatch}) => {

    useEffect(() => {
        if (open) {
            dispatch(initDevices(true));
        }
    }, [open]);

    return <Dialog open={open} scroll="body" onClose={onClose}>
        <DialogTitle>Choose Audio Devices</DialogTitle>
        <DialogContent dividers>
            <List>
                {devices?.inputs.map(d => <ListItem key={d.id} button selected={devices.selectedInputId === d.id} onClick={() => dispatch(selectInputDevice(d.id))}>
                    <ListItemIcon>
                        <MicIcon />
                    </ListItemIcon>
                    <ListItemText primary={d.name} />
                </ListItem>)}
            </List>
            {/* Web Audio API doesn't let you choose output devices, and if you pipe it into an <Audio/> tag, the latency is variable. Wow. */}
            {/*<Divider />*/}
            {/*<List>*/}
            {/*    {devices?.outputs.map(d => <ListItem key={d.id} button selected={devices.selectedOutputId === d.id} onClick={() => dispatch(selectOutputDevice(d.id))}>*/}
            {/*        <ListItemIcon>*/}
            {/*            <SpeakerIcon />*/}
            {/*        </ListItemIcon>*/}
            {/*        <ListItemText primary={d.name} />*/}
            {/*    </ListItem>)}*/}
            {/*</List>*/}
        </DialogContent>
        <DialogActions>
            <Button variant="contained" onClick={e => { onClose(e);}} autoFocus color="primary">Done</Button>
        </DialogActions>
    </Dialog>
};

export default connect(state => ({
    devices: state.devices,
}))(DeviceSelectionDialog);