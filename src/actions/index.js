
export const toast = (message, level='info') => ({
    type: "TOAST",
    level,
    message,
});