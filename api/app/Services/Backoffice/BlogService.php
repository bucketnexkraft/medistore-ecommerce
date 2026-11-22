<?php

namespace App\Services\Backoffice;

use App\Constant\Directory;
use App\Models\Blog;
use App\Models\BlogCategory;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Str;

class BlogService
{
    public function activeCategoryOptions()
    {
        return BlogCategory::query()
            ->where('status', true)
            ->orderBy('name')
            ->get(['id', 'name']);
    }

    public function paginate(array $filters): LengthAwarePaginator
    {
        $perPage = (int) ($filters['perPage'] ?? 20);
        $page = (int) ($filters['page'] ?? 1);
        $search = trim((string) ($filters['search'] ?? ''));
        $status = $filters['status'] ?? '';
        $categoryId = $filters['category_id'] ?? null;

        $query = Blog::query()->with('category:id,name');

        if ($search !== '') {
            $query->where(function ($q) use ($search) {
                $q->where('title', 'like', "%{$search}%")
                    ->orWhere('slug', 'like', "%{$search}%")
                    ->orWhere('short_description', 'like', "%{$search}%");
            });
        }

        if ($status !== '' && in_array((string) $status, ['0', '1'], true)) {
            $query->where('status', (int) $status);
        }

        if ($categoryId !== null && $categoryId !== '' && is_numeric($categoryId) && (int) $categoryId > 0) {
            $query->where('category_id', (int) $categoryId);
        }

        return $query->orderByDesc('id')->paginate($perPage, ['*'], 'page', $page);
    }

    public function validationRules(): array
    {
        return [
            'category_id' => ['required', 'integer', 'exists:blog_categories,id'],
            'title' => ['required', 'string', 'max:255'],
            'short_description' => ['required', 'string'],
            'description' => ['required', 'string'],
            'tags' => ['nullable', 'array'],
            'tags.*' => ['nullable', 'string', 'max:100'],
            'seo_tags' => ['nullable', 'array'],
            'seo_tags.*' => ['nullable', 'string', 'max:100'],
            'seo_description' => ['nullable', 'string'],
            'status' => ['required', 'boolean'],
            'is_show_in_home' => ['required', 'boolean'],
            'image' => imageValidation(),
        ];
    }

    public function create(array $data, ?string $adminId): Blog
    {
        $title = trim((string) $data['title']);
        $image = isset($data['image']) ? upload($data['image'], Directory::BLOG_PATH) : null;

        $blog = Blog::create([
            'category_id' => (int) $data['category_id'],
            'admin_id' => (string) ($adminId ?? ''),
            'title' => $title,
            'slug' => $this->uniqueSlug(Str::slug($title)),
            'short_description' => (string) $data['short_description'],
            'description' => (string) $data['description'],
            'tags' => $this->normalizeTags($data['tags'] ?? []),
            'seo_tags' => $this->normalizeTags($data['seo_tags'] ?? []),
            'seo_description' => (string) ($data['seo_description'] ?? ''),
            'image' => $image,
            'status' => $this->toBoolean($data['status']),
            'is_show_in_home' => $this->toBoolean($data['is_show_in_home']),
        ]);

        return $blog->fresh('category:id,name');
    }

    public function update(Blog $blog, array $data): Blog
    {
        $title = trim((string) $data['title']);
        $image = $blog->image;

        if (isset($data['image'])) {
            $image = upload($data['image'], Directory::BLOG_PATH, $blog->image ?? '');
        }

        $blog->update([
            'category_id' => (int) $data['category_id'],
            'title' => $title,
            'slug' => $this->uniqueSlug(Str::slug($title), $blog->id),
            'short_description' => (string) $data['short_description'],
            'description' => (string) $data['description'],
            'tags' => $this->normalizeTags($data['tags'] ?? []),
            'seo_tags' => $this->normalizeTags($data['seo_tags'] ?? []),
            'seo_description' => (string) ($data['seo_description'] ?? ''),
            'image' => $image,
            'status' => $this->toBoolean($data['status']),
            'is_show_in_home' => $this->toBoolean($data['is_show_in_home']),
        ]);

        return $blog->fresh('category:id,name');
    }

    public function delete(Blog $blog): void
    {
        if (!empty($blog->image)) {
            $old = public_path('images/' . Directory::BLOG_PATH . '/' . $blog->image);
            if (file_exists($old) && is_file($old)) {
                @unlink($old);
            }
        }

        $blog->delete();
    }

    private function normalizeTags(mixed $tags): array
    {
        return array_values(array_filter((array) $tags));
    }

    private function toBoolean(mixed $value): bool
    {
        return filter_var($value, FILTER_VALIDATE_BOOLEAN);
    }

    private function uniqueSlug(string $base, ?int $ignoreId = null): string
    {
        $slug = $base !== '' ? $base : 'blog';
        $source = $slug;
        $i = 1;

        while (true) {
            $query = Blog::query()->where('slug', $slug);
            if ($ignoreId !== null) {
                $query->where('id', '!=', $ignoreId);
            }
            if (!$query->exists()) {
                return $slug;
            }
            $slug = $source . '-' . $i;
            $i++;
        }
    }
}
