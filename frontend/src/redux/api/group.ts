import {api} from "./base";

export const group = api.injectEndpoints({
    endpoints: (builder) => ({
        CreateGroup : builder.mutation<any, any>({
            query: (credentials) => ({
                url: '/group/create',
                method: 'POST',
                body: credentials
            }),
            invalidatesTags: ['Group']
        })
    })
})

export const { useCreateGroupMutation } = group;