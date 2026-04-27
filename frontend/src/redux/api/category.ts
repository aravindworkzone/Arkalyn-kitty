import {api} from "./base";

export const category = api.injectEndpoints({
    endpoints: (builder) => ({
        createCategory: builder.mutation({
            query: (credentials) => ({
                url: '/category/create',
                method: 'POST',
                body: credentials
            })
        }),
        deleteCategory: builder.mutation({
            query: (credentials) => ({
                url: `/category/delete/${credentials}`,
                method: 'DELETE'
            })
        }),
    })
});

export const { useCreateCategoryMutation, useDeleteCategoryMutation } = category;