import { useCreateCategoryMutation, useDeleteCategoryMutation } from "../redux/api/category";
import type { Category } from "../interface/category";

export const useCategoryHandlers = (groupId: string | undefined) => {
  const [createCategory]                          = useCreateCategoryMutation();
  const [deleteCategory, { isLoading: isDeleting }] = useDeleteCategoryMutation();

  const handleAdd = async (
    name: string,
    color: string,
    categories: Category[],
    setError:      React.Dispatch<React.SetStateAction<string>>,
    setCategories: React.Dispatch<React.SetStateAction<Category[]>>,
    setName:       React.Dispatch<React.SetStateAction<string>>,
    setColor:      React.Dispatch<React.SetStateAction<string>>,
    defaultColor:  string
  ) => {
    const trimmed = name.trim();
    if (!trimmed)           return setError("Category name is required");
    if (trimmed.length < 2) return setError("Name must be at least 2 characters");
    if (categories.some((c) => c.name.toLowerCase() === trimmed.toLowerCase()))
      return setError("Category already exists");

    try {
      await createCategory({ name: trimmed, groupId, color }).unwrap();
    } catch (error: any) {
      return setError(error.data?.message || "Failed to create category");
    }

    setCategories((prev) => [
      ...prev,
      { _id: Date.now().toString(), name: trimmed, color, expenseCount: 0 },
    ]);
    setName("");
    setColor(defaultColor);
    setError("");
  };

  const handleDelete = async (
    selectedCategory: Category | null,
    setError:            React.Dispatch<React.SetStateAction<string>>,
    setCategories:       React.Dispatch<React.SetStateAction<Category[]>>,
    setCategoryModalOpen: React.Dispatch<React.SetStateAction<boolean>>,
    setSelectedCategory: React.Dispatch<React.SetStateAction<Category | null>>
  ) => {
    if (!selectedCategory) return;

    try {
      await deleteCategory({ id: selectedCategory._id, groupId }).unwrap();
      setCategories((prev) => prev.filter((c) => c._id !== selectedCategory._id));
      setCategoryModalOpen(false);
      setSelectedCategory(null);
    } catch (error: any) {
      setError(error.data?.message || "Failed to delete category");
    }
  };

  return { handleAdd, handleDelete, isDeleting };
};
