import { useCreateCategoryMutation, useDeleteCategoryMutation } from "../redux/api/category";
import type { Category } from "../interface/category";
import { validateCategoryName } from "../helpers/validators";
import type { SetFieldError } from "../hooks/useFieldError";

export type CategoryField = "name";

export const useCategoryHandlers = (groupId: string | undefined) => {
  const [createCategory]                             = useCreateCategoryMutation();
  const [deleteCategory, { isLoading: isDeleting }] = useDeleteCategoryMutation();

  const handleAdd = async (
    name: string,
    color: string,
    categories: Category[],
    setFieldError: SetFieldError<CategoryField>,
    setApiError:   React.Dispatch<React.SetStateAction<string>>,
    setCategories: React.Dispatch<React.SetStateAction<Category[]>>,
    setName:       React.Dispatch<React.SetStateAction<string>>,
    setColor:      React.Dispatch<React.SetStateAction<string>>,
    defaultColor:  string
  ) => {
    const nameV = validateCategoryName(name);
    if (!nameV.valid) { setFieldError("name", nameV.message); return; }

    if (categories.some((c) => c.name.toLowerCase() === name.trim().toLowerCase())) {
      setFieldError("name", "Category already exists");
      return;
    }

    try {
      await createCategory({ name: name.trim(), groupId, color }).unwrap();
    } catch (error: any) {
      setApiError(error.data?.message || "Failed to create category");
      return;
    }

    setCategories((prev) => [
      ...prev,
      { _id: Date.now().toString(), name: name.trim(), color, expenseCount: 0 },
    ]);
    setName("");
    setColor(defaultColor);
  };

  const handleDelete = async (
    selectedCategory: Category | null,
    setApiError:          React.Dispatch<React.SetStateAction<string>>,
    setCategories:        React.Dispatch<React.SetStateAction<Category[]>>,
    setCategoryModalOpen: React.Dispatch<React.SetStateAction<boolean>>,
    setSelectedCategory:  React.Dispatch<React.SetStateAction<Category | null>>
  ) => {
    if (!selectedCategory) return;

    try {
      await deleteCategory({ id: selectedCategory._id, groupId }).unwrap();
      setCategories((prev) => prev.filter((c) => c._id !== selectedCategory._id));
      setCategoryModalOpen(false);
      setSelectedCategory(null);
    } catch (error: any) {
      setApiError(error.data?.message || "Failed to delete category");
    }
  };

  return { handleAdd, handleDelete, isDeleting };
};
