import { useCreateCategoryMutation, useUpdateCategoryMutation, useDeleteCategoryMutation } from "../redux/api/category";
import type { Category, CategoryType } from "../interface/category";
import { validateCategoryName } from "../helpers/validators";
import type { SetFieldError } from "../hooks/useFieldError";
import { getApiErrorMessage } from "../hooks/useApiError";

export type CategoryField = "name";

export const useCategoryHandlers = (groupId: string | undefined, type: CategoryType = "EXPENSE") => {
  const [createCategory, { isLoading: isCreating }] = useCreateCategoryMutation();
  const [updateCategory, { isLoading: isUpdating }] = useUpdateCategoryMutation();
  const [deleteCategory, { isLoading: isDeleting }] = useDeleteCategoryMutation();

  const handleAdd = async (
    name: string,
    color: string,
    // Soft spend cap in cents; null = no limit.
    limitCents: number | null,
    categories: Category[],
    setFieldError: SetFieldError<CategoryField>,
    setApiError:   React.Dispatch<React.SetStateAction<string>>,
    setCategories: React.Dispatch<React.SetStateAction<Category[]>>,
    setName:       React.Dispatch<React.SetStateAction<string>>,
    setColor:      React.Dispatch<React.SetStateAction<string>>,
    setLimit:      React.Dispatch<React.SetStateAction<string>>,
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

    // Only expense categories carry a spend limit.
    const limit = type === "CREDIT" ? null : limitCents;

    try {
      await createCategory({ name: cleanName, groupId, color, type, limitCents: limit }).unwrap();
    } catch (error: unknown) {
      setApiError(getApiErrorMessage(error, "Failed to create category"));
      return;
    }

    setCategories((prev) => [
      ...prev,
      { _id: Date.now().toString(), name: cleanName, color, type, expenseCount: 0, limitCents: limit, spentCents: 0 },
    ]);
    setName("");
    setColor(defaultColor);
    setLimit("");
  };

  // Saves the inline row editor — colour and/or spend limit in one request.
  // `limitCents` of null clears the limit; undefined leaves it untouched.
  const handleEditCategory = async (
    category: Category,
    edits: { color?: string; limitCents?: number | null },
    setApiError:   React.Dispatch<React.SetStateAction<string>>,
    setCategories: React.Dispatch<React.SetStateAction<Category[]>>,
    onDone:        () => void
  ) => {
    if (!groupId) { setApiError("No group selected"); return; }

    const color = edits.color !== undefined && edits.color !== category.color ? edits.color : undefined;
    const limitCents =
      edits.limitCents !== undefined && edits.limitCents !== (category.limitCents ?? null)
        ? edits.limitCents
        : undefined;

    // No-op when nothing actually changed.
    if (color === undefined && limitCents === undefined) { onDone(); return; }

    try {
      await updateCategory({ id: category._id, groupId, color, limitCents }).unwrap();
      setCategories((prev) =>
        prev.map((c) =>
          c._id === category._id
            ? {
                ...c,
                ...(color !== undefined ? { color } : {}),
                ...(limitCents !== undefined ? { limitCents } : {}),
              }
            : c
        )
      );
      onDone();
    } catch (error: unknown) {
      setApiError(getApiErrorMessage(error, "Failed to update category"));
    }
  };

  const handleToggleSpecial = async (
    category: Category,
    setApiError:   React.Dispatch<React.SetStateAction<string>>,
    setCategories: React.Dispatch<React.SetStateAction<Category[]>>
  ) => {
    if (!groupId) { setApiError("No group selected"); return; }
    const next = !category.isSpecial;
    try {
      await updateCategory({ id: category._id, groupId, isSpecial: next }).unwrap();
      setCategories((prev) => prev.map((c) => (c._id === category._id ? { ...c, isSpecial: next } : c)));
    } catch (error: unknown) {
      setApiError(getApiErrorMessage(error, "Failed to update category"));
    }
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

  return { handleAdd, handleEditCategory, handleToggleSpecial, handleDelete, isCreating, isUpdating, isDeleting };
};
