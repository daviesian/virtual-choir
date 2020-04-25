import * as React from 'react';
import {connect} from "react-redux";
import {makeStyles} from "@material-ui/core/styles";
import ArrowDropDownIcon from '@material-ui/icons/ArrowDropDown';
import clsx from "clsx";
import {useEffect, useRef} from "react";

const useStyles = makeStyles(theme => ({
    cursor: {
        position: "absolute",
        top: 0,
        left: ({timePercent}) => `${timePercent}%`,
    },
    icon: {
        marginLeft: -16,
        marginTop: -16,
    },
    line: {
        height: "100%",
        width: 2,
        background: '#888',

    }
}));

let TransportCursor = ({timePercent=0, line, arrow, dispatch}) => {
    const classes = useStyles({
        timePercent,
    });

    let cursorRef = useRef();

    useEffect(() => {
        if (cursorRef.current) {
            //cursorRef.current.scrollIntoView({inline: 'center'});
            // TODO: Manually set scrolling here.
        }
    }, [timePercent]);

    return <div ref={cursorRef} className={clsx(classes.cursor, {[classes.line]: line})}>
        {arrow && <ArrowDropDownIcon className={classes.icon} fontSize="large"/>}
    </div>;
};

export default connect()(TransportCursor);