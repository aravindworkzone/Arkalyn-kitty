import {api} from "./base";

interface Category {
  _id: string;
  name: string;
  color: string;
  expenseCount: number;
}

interface CategoryResponse {
  message: string;
  category: Category[];
}

export const category = api.injectEndpoints({
    endpoints: (builder) => ({
        createCategory: builder.mutation({
            query: (credentials) => ({
                url: '/category/create',
                method: 'POST',
                body: credentials
            }),
            invalidatesTags: ['Category']
        }),
        deleteCategory: builder.mutation({
            query: (credentials) => ({
                url: `/category/delete/${credentials.id}/${credentials.groupId}`,
                method: 'DELETE'
            }),
            invalidatesTags: ['Category']
        }),
        getCategories: builder.query<Category[], any>({
            query: (groupId) => ({
                url: `/category/getCategoryDetails/${groupId}`,
                method: 'GET'
            }),
            transformResponse: (res: CategoryResponse) => res.category,
            providesTags: ['Category']
        }),
    })
});

export const { useCreateCategoryMutation, useDeleteCategoryMutation, useGetCategoriesQuery } = category;