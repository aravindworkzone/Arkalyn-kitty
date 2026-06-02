import {api} from "./base";
import type { Category } from "../../interface/category";
import type { ApiSuccess } from "../../interface/api";

interface CreateCategoryRequest { groupId: string; name: string; color?: string }
interface DeleteCategoryRequest { id: string; groupId: string }

export const category = api.injectEndpoints({
    endpoints: (builder) => ({
        createCategory: builder.mutation<ApiSuccess<{ category: Category }>, CreateCategoryRequest>({
            query: (credentials) => ({
                url: '/category/create',
                method: 'POST',
                body: credentials
            }),
            invalidatesTags: (_result, _error, arg) => [
                { type: "Category", id: arg.groupId }
            ]
        }),
        deleteCategory: builder.mutation<ApiSuccess<{ category: Category }>, DeleteCategoryRequest>({
            query: (credentials) => ({
                url: `/category/delete/${credentials.id}/${credentials.groupId}`,
                method: 'DELETE'
            }),
            invalidatesTags: (_result, _error, arg) => [
                { type: "Category", id: arg.groupId }
            ]
        }),
        getCategories: builder.query<Category[], string>({
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