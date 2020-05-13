import Dialog from "@material-ui/core/Dialog";
import * as React from 'react';
import clsx from 'clsx';
import {connect} from "react-redux";
import DialogTitle from "@material-ui/core/DialogTitle";
import DialogContent from "@material-ui/core/DialogContent";
import Typography from "@material-ui/core/Typography";
import TextField from "@material-ui/core/TextField";
import DialogActions from "@material-ui/core/DialogActions";
import Button from "@material-ui/core/Button";
import {useState} from "react";


let Modal = ({spec, dispatch}) => {
    let close = (resolveValue, rejectValue) => {
        if (resolveValue !== undefined) {
            dispatch({
                type: "modal/resolve",
                value: resolveValue,
            })
        } else {
            dispatch({
                type: "modal/reject",
                value: rejectValue,
            });
        }
    }

    return <Dialog open={true} onClose={() => close(spec.dismissResolveValue !== undefined ? spec.dismissResolveValue : null, spec.dismissRejectValue !== undefined ? spec.dismissRejectValue : 'dismiss')}>
        <DialogTitle>
            {spec.title}
        </DialogTitle>
        <DialogContent>
            <Typography variant="body1">{spec.content}</Typography>
        </DialogContent>
        <DialogActions>
            {spec.buttons.map((b,bi) => <Button key={bi} variant="contained" color={b.color || "primary"} disabled={b.disabled || false} onClick={() => close(b.resolveValue, b.rejectValue)}>{b.text}</Button>)}
        </DialogActions>
    </Dialog>
}

export default connect()(Modal);