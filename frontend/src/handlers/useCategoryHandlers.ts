import { useCreateCategoryMutation, useDeleteCategoryMutation } from "../redux/api/category";
import type { Category } from "../interface/category";
import { validateCategoryName } from "../helpers/validators";
import type { SetFieldError } from "../hooks/useFieldError";
import { getApiErrorMessage } from "../hooks/useApiError";

export type CategoryField = "name";

export const useCategoryHandlers = (groupId: string | undefined) => {
  const [createCategory, { isLoading: isCreating }] = useCreateCategoryMutation();
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

    // Collapse internal whitespace so "test  name" and "test name" are
    // treated as the same category — both for the duplicate check and the
    // stored value.
    const cleanName = name.trim().replace(/\s+/g, " ");

    if (categories.some((c) => c.name.trim().replace(/\s+/g, " ").toLowerCase() === cleanName.toLowerCase())) {
      setFieldError("name", "Category already exists");
      return;
    }

    if (!groupId) { setApiError("No group selected"); return; }

    try {
      await createCategory({ name: cleanName, groupId, color }).unwrap();
    } catch (error: unknown) {
      setApiError(getApiErrorMessage(error, "Failed to create category"));
      return;
    }

    setCategories((prev) => [
      ...prev,
      { _id: Date.now().toString(), name: cleanName, color, expenseCount: 0 },
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
    if (!groupId) { setApiError("No group selected"); return; }

    try {
      await deleteCategory({ id: selectedCategory._id, groupId }).unwrap();
      setCategories((prev) => prev.filter((c) => c._id !== selectedCategory._id));
      setCategoryModalOpen(false);
      setSelectedCategory(null);
    } catch (error: unknown) {
      setApiError(getApiErrorMessage(error, "Failed to delete category"));
    }
  };

  return { handleAdd, handleDelete, isCreating, isDeleting };
};
