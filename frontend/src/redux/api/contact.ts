import { api } from "./base";
import type { ContactRequest } from "../../interface/contact";

export const contact = api.injectEndpoints({
    endpoints: (builder) => ({
        submitContact: builder.mutation<{ message: string }, ContactRequest>({
            query: (body) => ({ url: "/contact", method: "POST", body }),
            transformResponse: (res: { message: string }) => ({ message: res.message }),
        }),
    }),
});

export const { useSubmitContactMutation } = contact;
