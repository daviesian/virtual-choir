import * as RSVP from "rsvp";

export default store => next => {

    let modals = [];

    return async action => {

        if (action.type.startsWith("modal/")) {
            switch (action.type.substr(6)) {
                case "show":
                    let d = RSVP.defer()
                    modals.push({
                        spec: action.spec,
                        ...d
                    });
                    store.dispatch({
                        type: "MODAL_PUSH",
                        spec: action.spec,
                    });
                    return d.promise;

                case "resolve":
                    modals.pop().resolve(action.value);
                    store.dispatch({
                        type: "MODAL_POP",
                    });
                    return;
                case "reject":
                    modals.pop().reject(action.value);
                    store.dispatch({
                        type: "MODAL_POP",
                    });
                    return;
            }
        } else {
            return next(action);
        }

    }
}