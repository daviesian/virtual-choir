import * as React from 'react';
import {connect} from "react-redux";
import {seek} from "../actions/audioActions";
import {makeStyles, useTheme} from "@material-ui/core/styles";
import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {
    addScore,
    addScoreTimingKeyframe,
    addScoreTimingSystem,
    removeScoreKeyframe, removeScoreSystem,
} from "../actions";
import Paper from "@material-ui/core/Paper";
import clsx from "clsx";
import pdfjs from "pdfjs-dist";
import Typography from "@material-ui/core/Typography";
import Fab from "@material-ui/core/Fab";
import AddIcon from "@material-ui/icons/Add";
import orange from "@material-ui/core/colors/orange";

pdfjs.GlobalWorkerOptions.workerSrc =
    '/node_modules/pdfjs-dist/build/pdf.worker.js';

const useStyles = makeStyles(theme => ({
    root: {
        position: "relative",
        background: 'white',
        minHeight: 0,
        overflow: 'auto',
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
    },
    addContainer: {
        height: '100%',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
    },
    addIcon: {
        marginRight: theme.spacing(1)
    },

    pageContainer: {

    },
    pageMeasure: {
        position: "absolute",
        top: theme.spacing(1),
        left: theme.spacing(1),
        right: theme.spacing(1),
        bottom: theme.spacing(1),
    },
    page: {
        position: 'relative',
        margin: [[theme.spacing(1), 'auto']],
    },
    pageCanvas: {
        position: 'absolute',
        width: "100%",
        height: "100%",
    },
    pageOverlay: {
        position: 'absolute',
        width: "100%",
        height: "100%",
        zIndex:1,
    }
}));


let distance = (from, to) => {
    return Math.sqrt((from.x-to.x)*(from.x-to.x) + (from.y-to.y)*(from.y-to.y));
}

let findRectUnderPointOnPage = (point, rects, verticalOnly=false) => {
    return rects.find(({x,y,width,height,page}) => point.page === page && point.y >= y && point.y < y+height && (verticalOnly || (point.x >= x && point.x < x+width)));
}

let pdfPointToTime = (pdfPoint, keyframes, systems) => {

    let kfsReverse = keyframes.slice();
    kfsReverse.reverse();
    let s = findRectUnderPointOnPage(pdfPoint, systems, true);
    if (s) {
        let kfStartIndex = keyframes.findIndex(k => k.page === s.page && k.x > s.x && k.y > s.y && k.x < s.x+s.width && k.y < s.y+s.height);
        let kfEndIndex = keyframes.length - 1 - kfsReverse.findIndex(k => k.page === s.page && k.x > s.x && k.y > s.y && k.x < s.x+s.width && k.y < s.y+s.height);
        if (kfStartIndex > -1 && kfEndIndex > -1) {

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
    }
};

let timeToPdfCursor = (time, keyframes, systems) => {
    let kfsReverse = keyframes.slice();
    kfsReverse.reverse();
    let k1 = kfsReverse.find(k => k.time <= time);
    let k2 = keyframes.find(k => k.time > time);
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

let PdfPageOverlay = React.forwardRef(({className, pdfScale, pageNumber, cursor, setCursorY, transportTime, annotations, conducting, dispatch}, canvas) => {
    let classes = useStyles();

    let canvasToPdf = useCallback(({x,y}) => {
        let canvasX = x - canvas.current.getBoundingClientRect().left;
        let canvasY = y - canvas.current.getBoundingClientRect().top;
        return {
            x: canvasX/pdfScale,
            y: canvasY/pdfScale,
            page: pageNumber,
        }
    }, [pdfScale, pageNumber]);

    let pdfToCanvas = useCallback(({x,y}) => {
        return {
            x: (x * pdfScale),
            y: (y * pdfScale),
        }
    }, [pdfScale]);

    let pdfRectToCanvas = useCallback(({x,y,width,height}) => {
        let {x: x1, y: y1} = pdfToCanvas({x,y});
        let {x: x2, y: y2} = pdfToCanvas({ x: x+width, y: y+height });
        return {
            x: x1,
            y: y1,
            width: x2-x1,
            height: y2-y1,
        }
    }, [pdfToCanvas]);

    let [grabPoint, setGrabPoint] = useState(null);
    let [selectionBoxCorner, setSelectionBoxCorner] = useState(null);
    let [editing, setEditing] = useState(false);
    let [cursorVerticalPos, setCursorVerticalPos] = useState(null);

    let canvasMouseDown = useCallback(e => {
        let pdfPoint = canvasToPdf({x: e.pageX, y: e.pageY});
        console.log(pdfPoint);
        setGrabPoint({...pdfPoint, time: transportTime});

        e.stopPropagation();
        e.preventDefault();
    }, [canvasToPdf, transportTime]);

    let canvasMouseMove = useCallback(e => {
        setEditing(e.ctrlKey);
        let pdfPoint = canvasToPdf({x: e.pageX, y: e.pageY});
        if (grabPoint && editing) {
            setSelectionBoxCorner(pdfPoint);
        }

        e.stopPropagation();
        e.preventDefault();
    }, [canvasToPdf, grabPoint, editing]);

    let canvasMouseUp = useCallback(e => {
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
                } else {
                    let sys = annotations?.timing?.systems || [];
                    let hoverSystem = findRectUnderPointOnPage(pdfPoint, sys);
                    if (hoverSystem) {
                        dispatch(removeScoreSystem(hoverSystem));
                        e.stopPropagation();
                        e.preventDefault();
                    }
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
                    x: Math.min(grabPoint.x, selectionBoxCorner.x),
                    y: Math.min(grabPoint.y, selectionBoxCorner.y),
                    width: Math.abs(selectionBoxCorner.x - grabPoint.x),
                    height: Math.abs(selectionBoxCorner.y - grabPoint.y),
                    page: pageNumber,
                }))
            }
        }

        setGrabPoint(null);
        setSelectionBoxCorner(null);

        e.stopPropagation();
        e.preventDefault();
    }, [canvasToPdf, grabPoint, selectionBoxCorner, pageNumber, annotations, pdfScale, conducting]);

    useEffect(() => {
        let ctx = canvas.current.getContext('2d');
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
            ctx.fillStyle = 'rgba(33, 150, 243,0.1)';
            ctx.strokeStyle = 'rgba(33, 150, 243, 1)';
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
                    ctx.fillStyle = keyframe.time > transportTime ? 'rgba(33, 150, 243)' : orange[700];
                    let a = pdfToCanvas({x: keyframe.x, y: keyframe.y});
                    let [w,h] = [6,8];
                    ctx.beginPath();
                    ctx.moveTo(a.x, a.y - h);
                    ctx.lineTo(a.x + w, a.y);
                    ctx.lineTo(a.x, a.y + h);
                    ctx.lineTo(a.x - w, a.y);
                    ctx.lineTo(a.x, a.y - h);
                    ctx.fill();
                }
            }
        }


        ctx.strokeStyle='rgba(33, 150, 243,0.8)';

        if (cursor) {
            // if (transportTime !== renderTransportTime.current) {
            //     setPageNumber(pdfCursor.page);
            // }
            if (pageNumber === cursor.page) {
                let canvasCursor = pdfRectToCanvas(cursor);
                ctx.strokeRect(canvasCursor.x, canvasCursor.y, 1, canvasCursor.height);
                setCursorY({
                    top: canvasCursor.y + canvas.current.parentElement.offsetTop,
                    height: canvasCursor.height
                });
            }
        }
        // renderTransportTime.current = transportTime;

    }, [cursor, editing, annotations, transportTime, selectionBoxCorner]);

    return <canvas ref={canvas} className={clsx(classes.pageOverlay, className)} onMouseDown={canvasMouseDown} onMouseMove={canvasMouseMove} onMouseUp={canvasMouseUp}/>
});

let PdfPage = ({page, className, zoom, setZoom, ...props}) => {
    let classes = useStyles();
    let theme = useTheme();

    let container = useRef();
    let measure = useRef();
    let canvas = useRef();
    let overlay = useRef();

    let pdfRender = useRef(null);

    let [size, setSize] = useState({ width:0, height: 0});
    let [pageScale, setPageScale] = useState(null);

    useEffect(() => {
        let containerRect = measure.current.getBoundingClientRect();
        let pageRect = { width: page.view[2], height: page.view[3] };

        let containerAspectRatio = containerRect.width / containerRect.height;
        let pageAspectRatio = pageRect.width / pageRect.height;

        let size = {};
        // First scale page to fit viewport
        if (containerAspectRatio > pageAspectRatio) {
            // Height is limiting factor. Pdf should be full height.
            size.height = containerRect.height;
            size.width = size.height * pageAspectRatio;
        } else {
            // Width is limiting factor. Pdf should be full width.
            size.width = containerRect.width;
            size.height = size.width / pageAspectRatio;
        }

        // Then zoom

        let maxWidth = containerRect.width - theme.spacing(2);
        let width = Math.min(maxWidth, size.width * zoom);
        if (width === maxWidth) {
            setZoom(width / size.width);
        }

        size.width = Math.floor(width);
        size.height = Math.floor(size.width / pageAspectRatio);

        setPageScale(size.width / pageRect.width);
        setSize(size);

        pdfRender.current?.cancel();
    }, [page, zoom]);

    let renderTimeout = useRef(null);
    useEffect(() => {
        clearTimeout(renderTimeout.current);
        if (pageScale && size.width && size.height) {
            renderTimeout.current = setTimeout(() => {
                pdfRender.current?.cancel();

                let superSample = 2;
                canvas.current.height = size.height*superSample;
                canvas.current.width = size.width*superSample;
                overlay.current.height = size.height;
                overlay.current.width = size.width;
                pdfRender.current = page.render({
                    canvasContext: canvas.current.getContext('2d'),
                    viewport: page.getViewport({scale: pageScale*superSample}),
                    background: 'transparent',
                });
                pdfRender.current.promise.catch(e => console.debug(e.message));
            }, 500);
        }
    },[pageScale, size.width, size.height]);


    return <div ref={container} className={clsx(classes.pageContainer, className)}>
        <div ref={measure} className={classes.pageMeasure}/>
        <Paper className={classes.page} style={size}>
            <canvas ref={canvas} className={classes.pageCanvas}/>
            <PdfPageOverlay ref={overlay} pdfScale={pageScale} pageNumber={page.pageNumber} {...props}/>
        </Paper>
    </div>

};

let Score = ({rehearsalState, conducting, transportTime, scoreUrl, annotations, dispatch, ...props}) => {
    let classes = useStyles();

    let score = useRef();
    let [zoom, setZoom] = useState(1);
    let [pages, setPages] = useState(null);
    let [cursor, setCursor] = useState(null);
    let [cursorY, setCursorY] = useState(0);

    useEffect(() => {(async () => {
        if (scoreUrl) {
            let pdf = await pdfjs.getDocument(scoreUrl).promise;
            let pages = [];
            for (let n = 1; n <= pdf.numPages; n++) {
                pages.push(await pdf.getPage(n));
            }
            setPages(pages);
        }
    })()},[scoreUrl]);

    let scoreWheel = e => {
        if (e.ctrlKey) {
            if (e.deltaY < 0) {
                setZoom(z => z*1.1);
            } else {
                setZoom(z => Math.max(1, z/1.1));
            }
            e.stopPropagation();
            e.preventDefault();
        }
    }

    useEffect(() => {
        score.current.addEventListener('mousewheel', scoreWheel);
    },[score.current]);

    useEffect(() => {
        let kfs = annotations?.timing?.keyframes || [];
        let sys = annotations?.timing?.systems || [];

        setCursor(timeToPdfCursor(transportTime, kfs, sys));
    }, [transportTime]);

    useEffect(() => {
            score.current.scrollTo({top: cursorY.top - (score.current.getBoundingClientRect().height - cursorY.height)/3, behavior: 'smooth'});
    }, [cursorY?.height]);

    return <Paper ref={score} square elevation={0} className={clsx(props.className,classes.root)} onContextMenu={e => e.preventDefault()}>
        {pages ? <> {pages.map((page, i) => <PdfPage key={i} {...{page, setCursorY, zoom, setZoom, annotations, transportTime, cursor, rehearsalState, conducting, dispatch}}/>)}
        </> : <div className={classes.addContainer}>
            {scoreUrl ? <Typography variant={'subtitle1'}>Loading score...</Typography> : conducting ? <>
                <input
                    accept={'.pdf'}
                    style={{ display: 'none' }}
                    id="file-upload-thing"
                    type="file"
                    onChange={e => dispatch(addScore(e.target.files[0]))}
                />
                <label htmlFor="file-upload-thing">
                    <Fab component='span' color={'default'} variant={'extended'}><AddIcon className={classes.addIcon}/> Add score</Fab>
                </label>
            </> : <Typography variant={'subtitle1'}>No score available</Typography>}
        </div>
        }
    </Paper>;
}

export default connect(state => ({
    conducting: state.conducting,
    transportTime: state.transport?.currentTime,
    rehearsalState: state.rehearsalState,
    annotations: state.project?.scoreAnnotations,
    scoreUrl: state.project?.scoreUrl,
}))(Score);