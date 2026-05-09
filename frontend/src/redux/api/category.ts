import {api} from "./base";
import type { Category, CategoryResponse } from "../../interface/category";

export const category = api.injectEndpoints({
    endpoints: (builder) => ({
        createCategory: builder.mutation({
            query: (credentials) => ({
                url: '/category/create',
                method: 'POST',
                body: credentials
            }),
            invalidatesTags: (_result, _error, arg) => [
                { type: "Category", id: arg.groupId }
            ]
        }),
        deleteCategory: builder.mutation({
            query: (credentials) => ({
                url: `/category/delete/${credentials.id}/${credentials.groupId}`,
                method: 'DELETE'
            }),
            invalidatesTags: (_result, _error, arg) => [
                { type: "Category", id: arg.groupId }
            ]
        }),
        getCategories: builder.query<Category[], any>({
            query: (groupId) => ({
                url: `/category/getCategoryDetails/${groupId}`,
                method: 'GET'
            }),
            transformResponse: (res: { data: {categories: Category[]} }) => res.data.categories,
            providesTags: (_result, _error, groupId) => [
                { type: "Category", id: groupId }
            ],
        }),
    })
});

export const { useCreateCategoryMutation, useDeleteCategoryMutation, useGetCategoriesQuery } = category;