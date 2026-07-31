import { configureStore } from "@reduxjs/toolkit";
import { api } from "./api/base.js";
import groupReducer from "./slice/group.slice";

export const store = configureStore({
    reducer: {
        [api.reducerPath]: api.reducer,
        group: groupReducer
    },

    middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(api.middleware)
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;