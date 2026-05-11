import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

const groupSlice = createSlice({
    name: "group",
    initialState: "",
    reducers: {
        setGroupId: (state, action: PayloadAction<string>) => action.payload,
        clearGroupId: () => "",
    }
});

export const { setGroupId, clearGroupId } = groupSlice.actions;

export default groupSlice.reducer;