import {connect} from "react-redux";
import {useRouteMatch} from "react-router";
import React, {useEffect} from "react";
import {requestJoinRoom, requestLeaveRoom} from "../actions";

let AppRouter = ({dispatch}) => {

    let routeMatch = useRouteMatch("/:room");
    let room = routeMatch?.params?.room;

    log.info("Route", routeMatch);

    useEffect(() => {

        if (room) {
            dispatch(requestJoinRoom(room))
        } else {
            dispatch(requestLeaveRoom());
        }
    }, [room]);

    return null;
};

export default connect()(AppRouter);