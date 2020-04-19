import {connect} from "react-redux";
import {useRouteMatch} from "react-router";
import React, {useEffect} from "react";
import {requestJoinRoom, requestLeaveRoom, setConducting} from "../actions";

let AppRouter = ({dispatch}) => {

    let roomMatch = useRouteMatch("/:room");
    let room = roomMatch?.params?.room || "/";

    let conductMatch = useRouteMatch("/:room/conduct");

    useEffect(() => {

        if (room) {
            dispatch(requestJoinRoom(room));
            if (conductMatch) {
                dispatch(setConducting(true));
            }
        } else {
            dispatch(requestLeaveRoom());
        }
    }, [room, conductMatch]);

    return null;
};

export default connect()(AppRouter);