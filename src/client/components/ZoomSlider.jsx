import * as React from "react";
import makeStyles from "@material-ui/core/styles/makeStyles";
import grey from "@material-ui/core/colors/grey";
import {useCallback} from "react";

let useStyles = makeStyles(theme => ({
    root: {
        position: 'relative',
        height: '100%',
    },
    timeline: {
        position: 'absolute',
        top: '50%',
        width: '100%',
        height: 1,
        backgroundColor: grey[400],
    },
    handle: {
        position: "absolute",
        height: '50%',
        top: '25%',
        left: ({value, max}) => `${100*value[0]/max}%`,
        width: ({value, max}) => `${100*(value[1]-value[0])/max}%`,
        backgroundColor: grey[400],
        borderLeft: [['5px solid', grey[500]]],
        borderRight: [['5px solid', grey[500]]],
        borderTop: [['2px solid', grey[400]]],
        borderBottom: [['2px solid', grey[400]]],
    }
}));

const ZoomSlider = ({value, max, onChange}) => {
    const classes = useStyles({value, max});

    const sliderClick = useCallback((e) => {
        document.addEventListener("mouseup", function f(e) {
            document.removeEventListener("mouseup", f);
            console.log("UP", e);
        })
        console.log("DOWN", e);
    });

    return <div className={classes.root} onMouseDown={sliderClick}>
        <div className={classes.timeline}/>
        <div className={classes.handle}/>
    </div>
}

export default ZoomSlider;