'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi, Category } from '@/app/lib/api/admin';
import { queryKeys } from '@/app/lib/api/queryKeys';
import { Button } from '@/app/components/ui/button';
import { useAdminConfirmation } from '@/app/components/admin/useAdminConfirmation';
import { useGlobalToast } from '@/app/components/common/Toast';
import { useState } from 'react';

export default function CategoriesPage() {
  const queryClient = useQueryClient();
  const { openConfirmation } = useAdminConfirmation();
  const toast = useGlobalToast();
  const [isCreating, setIsCreating] = useState(false);
  const [newCategory, setNewCategory] = useState({ name: '', description: '', color: '#6366f1' });

  const { data: categories = [], isLoading } = useQuery<Category[]>({
    queryKey: queryKeys.admin.categories.list(true),
    queryFn: () => adminApi.getCategories(true),
  });

  const createMutation = useMutation({
    mutationFn: (input: { name: string; description?: string; color?: string }) =>
      adminApi.createCategory({
        name: input.name,
        description: input.description || undefined,
        color: input.color || '#6366f1',
        isActive: true,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.categories.all() });
      toast.success('Category created');
      setNewCategory({ name: '', description: '', color: '#6366f1' });
      setIsCreating(false);
    },
    onError: () => toast.error('Failed to create category'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminApi.deleteCategory(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.categories.all() });
      toast.success('Category deleted');
    },
    onError: () => toast.error('Failed to delete category'),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      adminApi.updateCategory(id, { isActive: !isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.categories.all() });
      toast.success('Category updated');
    },
    onError: () => toast.error('Failed to update category'),
  });

  const handleCreate = () => {
    if (!newCategory.name.trim()) return;
    createMutation.mutate({
      name: newCategory.name.trim(),
      description: newCategory.description.trim() || undefined,
      color: newCategory.color,
    });
  };

  const handleDelete = (id: string, name: string) => {
    openConfirmation({
      title: 'Delete category?',
      description: `This will delete "${name}". This action cannot be undone.`,
      confirmLabel: 'Delete',
      variant: 'danger',
      action: () => deleteMutation.mutateAsync(id),
      successMessage: 'Category deleted.',
      errorMessage: 'Failed to delete category.',
    });
  };

  const handleToggleActive = (id: string, currentActive: boolean) => {
    toggleActiveMutation.mutate({ id, isActive: currentActive });
  };

  if (isLoading) {
    return <div className="text-center py-8 text-gray-500">Loading categories...</div>;
  }

  return (
    <div className="min-w-0 space-y-6">
      {confirmDialog}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Categories</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Manage confession categories for browsing and filtering
          </p>
        </div>
        <Button onClick={() => setIsCreating(!isCreating)} className="min-h-[44px]">
          {isCreating ? 'Cancel' : 'New Category'}
        </Button>
      </div>

      {isCreating && (
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Name</label>
            <input
              type="text"
              value={newCategory.name}
              onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
              placeholder="e.g. Relationships"
              className="w-full rounded-md border border-gray-300 px-3 py-2 dark:bg-gray-700 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Description</label>
            <input
              type="text"
              value={newCategory.description}
              onChange={(e) => setNewCategory({ ...newCategory, description: e.target.value })}
              placeholder="Brief description of the category"
              className="w-full rounded-md border border-gray-300 px-3 py-2 dark:bg-gray-700 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Color</label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={newCategory.color}
                onChange={(e) => setNewCategory({ ...newCategory, color: e.target.value })}
                className="h-10 w-16 cursor-pointer rounded border border-gray-300"
              />
              <span className="text-sm text-gray-500">{newCategory.color}</span>
            </div>
          </div>
          <div className="flex gap-3">
            <Button onClick={handleCreate} disabled={!newCategory.name.trim()} isLoading={createMutation.isPending} className="min-h-[44px]">
              Create Category
            </Button>
          </div>
        </div>
      )}

      {categories.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-8 text-center">
          <p className="text-lg font-medium text-gray-900 dark:text-white">No categories yet</p>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">Create your first category to help users browse confessions.</p>
        </div>
      ) : (
        <div className="min-w-0 max-w-full overflow-hidden rounded-lg bg-white shadow dark:bg-gray-800">
          <div className="max-w-full overflow-x-auto overscroll-x-contain">
            <table className="min-w-[48rem] divide-y divide-gray-200 dark:divide-gray-700 md:min-w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Color</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Slug</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Description</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Active</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Count</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider sticky right-0 bg-gray-50 dark:bg-gray-700 after:absolute after:inset-y-0 after:left-0 after:w-px after:bg-gray-300 dark:after:bg-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {categories.map((cat) => (
                  <tr key={cat.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-block h-4 w-4 rounded-full border border-gray-300" style={{ backgroundColor: cat.color }} />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {cat.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {cat.slug}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 max-w-xs truncate">
                      {cat.description || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() => handleToggleActive(cat.id, cat.isActive)}
                        className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${cat.isActive ? 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100' : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'}`}
                      >
                        {cat.isActive ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {cat.confessionCount}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium sticky right-0 bg-white dark:bg-gray-800 after:absolute after:inset-y-0 after:left-0 after:w-px after:bg-gray-200 dark:after:bg-gray-700">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(cat.id, cat.name)}
                        className="min-h-[44px] min-w-[44px] rounded-md px-3 text-red-600 hover:text-red-800"
                        aria-label={`Delete category ${cat.name}`}
                      >
                        Delete
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
