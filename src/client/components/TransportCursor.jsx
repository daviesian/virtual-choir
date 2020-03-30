import * as React from 'react';
import {connect} from "react-redux";
import {makeStyles} from "@material-ui/core/styles";

const useStyles = makeStyles(theme => ({
    cursor: {
        position: "absolute",
        top: 0,
        left: ({timePercent}) => `${timePercent}%`,
        height: "100%",
        width: 2,
        background: '#888',
    },
}));

let TransportCursor = ({timePercent=0, dispatch}) => {
    const classes = useStyles({
        timePercent,
    });
    return <div className={classes.cursor}/>;
};

export default connect()(TransportCursor);