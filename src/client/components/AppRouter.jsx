import {connect} from "react-redux";
import {useRouteMatch} from "react-router";
import React, {useEffect} from "react";
import {requestJoinRoom, requestLeaveRoom, setConducting} from "../actions";
import {rtcConnect} from "../actions/rtcActions";
import {init} from "../actions/audioActions";

let AppRouter = ({dispatch}) => {

    let roomMatch = useRouteMatch("/:roomId");
    let roomId = roomMatch?.params?.roomId || "/";

    let conductMatch = useRouteMatch("/:roomId/conduct");

    useEffect(() => {(async () => {

        if (roomId) {
            await dispatch(requestJoinRoom(roomId));
            if (conductMatch) {
                await dispatch(setConducting(true));
            }
            await dispatch(init());
            await dispatch(rtcConnect());

        } else {
            dispatch(requestLeaveRoom());
        }
    })()}, [roomId, !!conductMatch]);

    return null;
};

export default connect()(AppRouter);