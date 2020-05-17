import * as React from 'react';
import {connect} from "react-redux";
import List from "@material-ui/core/List";
import ListItem from "@material-ui/core/ListItem";
import ListItemText from "@material-ui/core/ListItemText";
import {seek} from "../actions/audioActions";
import {makeStyles} from "@material-ui/core/styles";
import {useCallback, useEffect, useRef, useState} from "react";
import {
    addLyrics,
    addScoreTimingKeyframe,
    addScoreTimingSystem,
    annotateScore,
    clearScoreAnnotations, clearScoreKeyframes, clearScoreSystems, removeScoreKeyframe,
    setRehearsalState
} from "../actions";
import PlayArrowIcon from "@material-ui/icons/PlayArrow";
import AddIcon from "@material-ui/icons/Add";
import Paper from "@material-ui/core/Paper";
import Typography from "@material-ui/core/Typography";
import Fab from "@material-ui/core/Fab";
import CloudUploadIcon from "@material-ui/icons/CloudUpload";
import Button from "@material-ui/core/Button";
import clsx from "clsx";
import pdfjs from "pdfjs-dist";
import yellow from "@material-ui/core/colors/yellow";

pdfjs.GlobalWorkerOptions.workerSrc =
    '/node_modules/pdfjs-dist/build/pdf.worker.js';

const useStyles = makeStyles(theme => ({
    root: {
        position: "relative",
        background: 'white',
    },
    scoreCanvas: {
        width: '100%',
        height: '100%',
        position: "absolute",
    },
    overlayCanvas: {
        width: '100%',
        height: '100%',
        position: "absolute",
        background: 'transparent'
    },
    annotationControls: {
        display: 'inline-block',
        position: 'absolute',
        top: theme.spacing(2),
        right: theme.spacing(2),
        padding: theme.spacing(2),
    }
}));


let Score = ({rehearsalState, conducting, transportTime, annotations, dispatch, className}) => {
    let classes = useStyles();
    let canvas = useRef();
    let overlay = useRef();

    let [pdf, setPdf] = useState(null);
    let [pdfScale, setPdfScale] = useState();
    let [pdfOffset, setPdfOffset] = useState({x:0,y:0});
    let [pageNumber, setPageNumber] = useState(rehearsalState?.scorePageNumber || 1);

    let [canvasUpdate, setCanvasUpdate] = useState(0);
    let pdfRender = useRef(null);

    useEffect(() => {(async () => {
        setPdf(await pdfjs.getDocument("/Time After Time.pdf").promise);
    })()},[]);

    useEffect(() => {(async () => {
        if (!pdf || !pageNumber) {
            return;
        }
        let page = await pdf.getPage(pageNumber);
        let [_x, _y, pageWidth, pageHeight] = page.view;

        let canvasRect = canvas.current.getBoundingClientRect();
        let pdfRect = { width: page.view[2], height: page.view[3] };

        let canvasAspectRatio = canvasRect.width / canvasRect.height;
        let pdfAspectRatio = pdfRect.width / pdfRect.height;

        if (canvasAspectRatio > pdfAspectRatio) {
            // Height is limiting factor. Pdf should be full height, and horizontally centered
            pdfScale = canvasRect.height/ pdfRect.height;
            pdfOffset.x = (canvasRect.width - pdfRect.width*pdfScale) / 2;
        } else {
            // Width is limiting factor. Pdf should be full width, and vertically centered
            pdfScale = canvasRect.width / pdfRect.width;
            pdfOffset.y = (canvasRect.height - pdfRect.height*pdfScale) / 2;
        }

        window.page = page;
        window.pdf = pdf;
        let viewport = page.getViewport({scale: pdfScale, offsetX: pdfOffset.x, offsetY: pdfOffset.y});

        canvas.current.height = canvasRect.height;
        canvas.current.width = canvasRect.width;
        overlay.current.height = canvasRect.height;
        overlay.current.width = canvasRect.width;


        let canvasContext = canvas.current.getContext('2d');
        if(pdfRender.current) {
            pdfRender.current.cancel();
        }
        pdfRender.current = page.render({
            canvasContext,
            viewport,
            background: 'transparent',
        });
        pdfRender.current.promise.catch((e) => console.log("PDF Render failed:", e.message));

        setPdfScale(pdfScale);
        setPdfOffset(pdfOffset);
        setCanvasUpdate(canvasUpdate + 1);
    })()},[pdf, pageNumber]);

    let canvasToPdf = ({x,y}) => {
        let canvasX = x - canvas.current.getBoundingClientRect().left;
        let canvasY = y - canvas.current.getBoundingClientRect().top;
        return {
            x: (canvasX - pdfOffset.x)/pdfScale,
            y: (canvasY - pdfOffset.y)/pdfScale,
        }
    }

    let pdfToCanvas = ({x,y}) => {
        return {
            x: (x * pdfScale) + pdfOffset.x,
            y: (y * pdfScale) + pdfOffset.y,
        }
    }

    let pdfRectToCanvas = ({x,y,width,height}) => {
        let {x: w, y: h} = pdfToCanvas({ x: width, y: height });
        return {
            ...pdfToCanvas({x,y}),
            width: w,
            height: h,
        }
    }

    let distance = (from, to) => {
        return Math.sqrt((from.x-to.x)*(from.x-to.x) + (from.y-to.y)*(from.y-to.y));
    }

    let findRectUnderPointOnPage = (point, rects, verticalOnly=false) => {
        return rects.find(({x,y,width,height,page}) => point.page === page && point.y >= y && point.y < y+height && (verticalOnly || (point.x >= x && point.x < x+width)));
    }

    let timeToPdfCursor = (time, keyframes, systems) => {
        let kfsReverse = keyframes.slice();
        kfsReverse.reverse();
        let k1 = kfsReverse.find(k => k.time <= transportTime);
        let k2 = keyframes.find(k => k.time > transportTime);
        if (k1 && k2) {
            let s1 = findRectUnderPointOnPage(k1, systems);
            let s2 = findRectUnderPointOnPage(k2, systems);
            if (s1 && s2) {
                let dist;
                let page = s1.page;
                if (s1 === s2) {
                    dist = k2.x - k1.x;
                } else {
                    dist = s1.x + s1.width - k1.x + k2.x - s2.x;
                }
                let cursorX = k1.x + dist * (time - k1.time)/(k2.time-k1.time);
                let cursorVertical = s1;
                if (cursorX > s1.x + s1.width) {
                    cursorX = cursorX - s1.x - s1.width + s2.x;
                    cursorVertical = s2;
                    page = s2.page;
                }

                return {
                    x: cursorX,
                    y: cursorVertical.y,
                    height: cursorVertical.height,
                    page,
                };
            }
        }
    };

    let pdfPointToTime = (pdfPoint, keyframes, systems) => {
        let kfsReverse = keyframes.slice();
        kfsReverse.reverse();
        let s = findRectUnderPointOnPage({...pdfPoint, page: pageNumber}, systems, true);
        if (s) {
            let kfStartIndex = keyframes.findIndex(k => k.page === s.page && k.x > s.x && k.y > s.y && k.x < s.x+s.width && k.y < s.y+s.height);
            let kfEndIndex = keyframes.length - 1 - kfsReverse.findIndex(k => k.page === s.page && k.x > s.x && k.y > s.y && k.x < s.x+s.width && k.y < s.y+s.height);
            if (pdfPoint.x >= keyframes[kfStartIndex].x && pdfPoint.x < keyframes[kfEndIndex].x) {
                // Within system
                let prevKf, nextKf;
                for (let i = kfStartIndex; i <= kfEndIndex; i++) {
                    if (keyframes[i].x <= pdfPoint.x) {
                        prevKf = keyframes[i];
                    }
                    if (keyframes[i].x > pdfPoint.x) {
                        nextKf = keyframes[i];
                        break;
                    }
                }
                return prevKf.time + ((pdfPoint.x-prevKf.x)/(nextKf.x-prevKf.x))*(nextKf.time-prevKf.time)
            } else if (pdfPoint.x < keyframes[kfStartIndex].x) {
                // Before first kf in system
                return keyframes[kfStartIndex].time;
            } else {
                // After last kf in system
                if (keyframes.length > kfEndIndex + 1) {
                    let prevKf = keyframes[kfEndIndex];
                    let nextKf = keyframes[kfEndIndex+1];
                    if (pdfPoint.x > s.x+s.width) {
                        // We're off the end of the system. Jump to start of next.
                        return nextKf.time;
                    } else {
                        // We're still inside this system. Interpolate.
                        let nextSystem = findRectUnderPointOnPage(nextKf, systems)
                        return prevKf.time + ((pdfPoint.x-prevKf.x)/(s.x+s.width - prevKf.x + nextKf.x - nextSystem.x)) * (nextKf.time - prevKf.time);
                    }
                } else {
                    // We dont have a next keyframe.
                    return keyframes[kfEndIndex].time;
                }
            }
        }
    };

    let [grabPoint, setGrabPoint] = useState(null);
    let [selectionBoxCorner, setSelectionBoxCorner] = useState(null);
    let [editing, setEditing] = useState(false);

    let canvasMouseDown = e => {
        let pdfPoint = canvasToPdf({x: e.pageX, y: e.pageY});
        setGrabPoint({...pdfPoint, time: transportTime});

        e.stopPropagation();
        e.preventDefault();
    }

    let canvasMouseMove = e => {
        setEditing(e.ctrlKey);
        let pdfPoint = canvasToPdf({x: e.pageX, y: e.pageY});
        if (grabPoint && editing) {
            setSelectionBoxCorner(pdfPoint);
        }

        e.stopPropagation();
        e.preventDefault();
    }

    let canvasMouseUp = e => {
        let pdfPoint = canvasToPdf({x: e.pageX, y: e.pageY});

        if (!grabPoint)
            return;

        if (distance(grabPoint, pdfPoint)*pdfScale < 10) {
            // This was a click
            if (e.ctrlKey && e.button === 0) {
                // Ctrl-click
                dispatch(addScoreTimingKeyframe({
                    ...pdfPoint,
                    time: grabPoint.time,
                    page: pageNumber,
                }))
            } else if (e.ctrlKey && e.button === 2) {
                // Right click
                let kfs = annotations?.timing?.keyframes || [];
                let nearbyKeyframe = kfs.find(k => distance(k, pdfPoint)*pdfScale < 5);
                if (nearbyKeyframe) {
                    dispatch(removeScoreKeyframe(nearbyKeyframe));
                    e.stopPropagation();
                    e.preventDefault();
                }
            } else {
                let clickTime = pdfPointToTime(pdfPoint, annotations?.timing?.keyframes || [], annotations?.timing?.systems || []);
                if (clickTime != null) {
                    dispatch(seek(clickTime, true, conducting));
                }
            }
        } else if (selectionBoxCorner) {
            if (e.ctrlKey) {
                dispatch(addScoreTimingSystem({
                    x: grabPoint.x,
                    y: grabPoint.y,
                    width: selectionBoxCorner.x - grabPoint.x,
                    height: selectionBoxCorner.y - grabPoint.y,
                    page: pageNumber,
                }))
            }
        }

        setGrabPoint(null);
        setSelectionBoxCorner(null);

        e.stopPropagation();
        e.preventDefault();
    }

    let canvasScroll = e => {
        if (e.deltaY < 0) {
            setPageNumber(Math.max(1, pageNumber - 1));
        } else {
            setPageNumber(Math.min(pageNumber + 1, pdf.numPages));
        }
        e.stopPropagation();
        //e.preventDefault(); // TODO: Make this event handler non-passive, then do this to prevent zoom.
    }

    useEffect(() => {
        let ctx = overlay.current.getContext('2d');
        ctx.clearRect(0,0,9999, 9999);
        ctx.fillStyle='rgba(33, 150, 243,0.1)';
        ctx.strokeStyle='rgba(33, 150, 243)';
        if (grabPoint && selectionBoxCorner) {
            let a = pdfToCanvas(grabPoint);
            let b = pdfToCanvas(selectionBoxCorner);
            ctx.fillRect(a.x, a.y, b.x-a.x, b.y-a.y);
            ctx.strokeRect(a.x, a.y, b.x-a.x, b.y-a.y);
        }

        let kfs = annotations?.timing?.keyframes || [];
        let sys = annotations?.timing?.systems || [];

        if (editing) {
            ctx.fillStyle = 'rgba(33, 150, 243,0.05)';
            ctx.strokeStyle = 'rgba(33, 150, 243, 0.05)';
            for (let box of sys) {
                if (box.page === pageNumber) {
                    let a = pdfToCanvas({x: box.x, y: box.y});
                    let b = pdfToCanvas({x: box.x + box.width, y: box.y + box.height});
                    ctx.fillRect(a.x, a.y, b.x - a.x, b.y - a.y);
                    ctx.strokeRect(a.x, a.y, b.x - a.x, b.y - a.y);
                }
            }
            for (let keyframe of kfs) {
                if (keyframe.page === pageNumber) {
                    ctx.fillStyle = keyframe.time > transportTime ? 'rgba(33, 150, 243)' : 'red';
                    let a = pdfToCanvas({x: keyframe.x, y: keyframe.y});
                    ctx.fillRect(a.x - 5, a.y - 5, 10, 10);
                }
            }
        }


        ctx.strokeStyle='rgba(33, 150, 243,0.8)';

        let pdfCursor = timeToPdfCursor(transportTime, kfs, sys);
        if (pdfCursor) {
            setPageNumber(pdfCursor.page);
            let canvasCursor = pdfRectToCanvas(pdfCursor);
            ctx.strokeRect(canvasCursor.x, canvasCursor.y, 1, canvasCursor.height);
        }

    }, [canvasUpdate, transportTime, editing, annotations, selectionBoxCorner]);

    return <Paper square elevation={0} style={{minHeight: 0, overflow: 'auto'}} className={clsx(className,classes.root)}>
        <canvas ref={canvas} className={classes.scoreCanvas}/>
        <canvas ref={overlay} className={classes.overlayCanvas}
                onMouseDown={canvasMouseDown}
                onMouseMove={canvasMouseMove}
                onMouseUp={canvasMouseUp}
                onContextMenu={e => e.preventDefault()}
                onWheel={canvasScroll}
        />
        {/*<Paper className={classes.annotationControls}>*/}
        {/*    <Button variant={'contained'} color={'primary'} onClick={() => dispatch(clearScoreKeyframes())}>Clear Keyframes</Button>*/}
        {/*    <Button variant={'contained'} color={'primary'} onClick={() => dispatch(clearScoreSystems())}>Clear Systems</Button>*/}
        {/*</Paper>*/}
    </Paper>;
};

export default connect(state => ({
    conducting: state.conducting,
    transportTime: state.transport?.currentTime,
    rehearsalState: state.rehearsalState,
    annotations: state.project?.scoreAnnotations,
}))(Score);