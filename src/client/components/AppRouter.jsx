import {connect} from "react-redux";
import {useRouteMatch} from "react-router";
import React, {useEffect} from "react";
import {requestJoinRoom, requestLeaveRoom, setConducting} from "../actions";

let AppRouter = ({dispatch}) => {

    let roomMatch = useRouteMatch("/:roomId");
    let roomId = roomMatch?.params?.roomId || "/";

    let conductMatch = useRouteMatch("/:roomId/conduct");

    useEffect(() => {(async () => {

        console.warn("RRR", !!roomId, !!conductMatch);

        if (roomId) {
            await dispatch(requestJoinRoom(roomId));
            if (conductMatch) {
                dispatch(setConducting(true));
            }
        } else {
            dispatch(requestLeaveRoom());
        }
    })()}, [roomId, !!conductMatch]);

    return null;
};

export default connect()(AppRouter);