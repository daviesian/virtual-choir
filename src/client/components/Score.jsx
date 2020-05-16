import * as React from 'react';
import {connect} from "react-redux";
import List from "@material-ui/core/List";
import ListItem from "@material-ui/core/ListItem";
import ListItemText from "@material-ui/core/ListItemText";
import {seek} from "../actions/audioActions";
import {makeStyles} from "@material-ui/core/styles";
import {useCallback, useEffect, useRef, useState} from "react";
import {addLyrics, setRehearsalState} from "../actions";
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
    }
}));


let Score = ({rehearsalState, conducting, transportTime, dispatch, className}) => {
    let classes = useStyles();
    let canvas = useRef();
    let overlay = useRef();

    let [pdfScale, setPdfScale] = useState();
    let [pdfOffset, setPdfOffset] = useState({x:0,y:0});



    useEffect(() => {(async () => {
        let pdf = await pdfjs.getDocument("/Time After Time.pdf").promise;
        let page = await pdf.getPage(1);
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
        let viewport = page.getViewport({scale: pdfScale, offsetX: pdfOffset.x, offsetY: pdfOffset.y});

        canvas.current.height = canvasRect.height;
        canvas.current.width = canvasRect.width;
        overlay.current.height = canvasRect.height;
        overlay.current.width = canvasRect.width;


        let canvasContext = canvas.current.getContext('2d');
        page.render({
            canvasContext,
            viewport,
            background: 'transparent',
        });

        setPdfScale(pdfScale);
        setPdfOffset(pdfOffset);
    })()},[]);

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

    let distance = (from, to) => {
        return Math.sqrt((from.x-to.x)*(from.x-to.x) + (from.y-to.y)*(from.y-to.y));
    }

    let [grabPoint, setGrabPoint] = useState(null);
    let [selectionBoxCorner, setSelectionBoxCorner] = useState(null);

    let [boxes, setBoxes] = useState([]);
    let [keyframes, setKeyframes] = useState([]);

    let canvasMouseDown = e => {
        let pdfPoint = canvasToPdf({x: e.pageX, y: e.pageY});
        setGrabPoint(pdfPoint);

        e.stopPropagation();
        e.preventDefault();
    }

    let canvasMouseMove = e => {
        let pdfPoint = canvasToPdf({x: e.pageX, y: e.pageY});
        if (grabPoint) {
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
            keyframes.push({...pdfPoint, time: transportTime});
            setKeyframes(keyframes);
        } else if (selectionBoxCorner) {
            boxes.push({
                x: grabPoint.x,
                y: grabPoint.y,
                width: selectionBoxCorner.x - grabPoint.x,
                height: selectionBoxCorner.y - grabPoint.y,
            })
            setBoxes(boxes);
        }

        setGrabPoint(null);
        setSelectionBoxCorner(null);

        e.stopPropagation();
        e.preventDefault();
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
        for (let box of boxes) {
            let a = pdfToCanvas({x:box.x, y: box.y});
            let b = pdfToCanvas({x: box.x + box.width, y: box.y + box.height});
            ctx.fillRect(a.x, a.y, b.x-a.x, b.y-a.y);
            ctx.strokeRect(a.x, a.y, b.x-a.x, b.y-a.y);
        }
        for (let keyframe of keyframes) {
            ctx.fillStyle= keyframe.time > transportTime ? 'rgba(33, 150, 243)' :  'red';
            let a = pdfToCanvas({x:keyframe.x, y: keyframe.y});
            ctx.fillRect(a.x-5, a.y-5, 10, 10);
        }
    }, [transportTime, boxes, keyframes, grabPoint, selectionBoxCorner]);

    return <Paper square elevation={0} style={{minHeight: 0, overflow: 'auto'}} className={clsx(className,classes.root)}>
        <canvas ref={canvas} className={classes.scoreCanvas}/>
        <canvas ref={overlay} className={classes.overlayCanvas} onMouseDown={canvasMouseDown} onMouseMove={canvasMouseMove} onMouseUp={canvasMouseUp} />
    </Paper>;
};

export default connect(state => ({
    conducting: state.conducting,
    transportTime: state.transport?.currentTime,
    rehearsalState: state.rehearsalState,
}))(Score);