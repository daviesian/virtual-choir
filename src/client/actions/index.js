
export const toast = (message, level='info') => ({
    type: "TOAST",
    level,
    message,
});

export const requestJoinRoom = (room) => ({
    type: "ws/call",
    fn: "joinRoom",
    kwargs: { room },
});

export const requestLeaveRoom = () => ({
    type: "ws/call",
    fn: "leaveRoom",
});