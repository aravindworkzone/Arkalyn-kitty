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
        getCategories: builder.query<any, any>({
            query: (credentials) => ({
                url: `/category/getCategoryDetails/${credentials}`,
                method: 'GET'
            }),
            providesTags: ['Category']
        }),
    })
});

export const { useCreateCategoryMutation, useDeleteCategoryMutation, useGetCategoriesQuery } = category;