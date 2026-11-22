<?php

namespace App\Http\Controllers\Api\Backoffice;

use App\Http\Controllers\Controller;
use App\Models\BlogCategory;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

class BlogCategoryController extends Controller
{
    private function ensureSuperAdmin()
    {
        $user = Auth::user();
        if (!$user || !$user->isSuperAdmin()) {
            return response()->json([
                'status' => 0,
                'message' => 'Forbidden. Super admin access required.',
            ], 403);
        }

        return null;
    }

    public function index(Request $request)
    {
        $forbidden = $this->ensureSuperAdmin();
        if ($forbidden) return $forbidden;

        $perPage = (int) $request->input('perPage', 20);
        $page = (int) $request->input('page', 1);
        $search = trim((string) $request->input('search', ''));
        $status = $request->input('status', '');

        $query = BlogCategory::query();

        if ($search !== '') {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('slug', 'like', "%{$search}%");
            });
        }

        if ($status !== '' && in_array((string) $status, ['0', '1'], true)) {
            $query->where('status', (int) $status);
        }

        $rows = $query->withCount('blogs')->orderByDesc('id')->paginate($perPage, ['*'], 'page', $page);

        return response()->json([
            'status' => 1,
            'message' => 'Blog categories fetched successfully.',
            'data' => $rows->items(),
            'meta' => [
                'current_page' => $rows->currentPage(),
                'per_page' => $rows->perPage(),
                'total' => $rows->total(),
                'last_page' => $rows->lastPage(),
            ],
        ]);
    }

    public function store(Request $request)
    {
        $forbidden = $this->ensureSuperAdmin();
        if ($forbidden) return $forbidden;

        $validator = Validator::make($request->all(), [
            'name' => ['required', 'string', 'max:191', Rule::unique('blog_categories', 'name')],
            'status' => ['nullable', 'boolean'],
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 0,
                'errors' => $validator->errors()->all(),
            ], 422);
        }

        $name = trim((string) $request->input('name'));
        $slug = $this->uniqueSlug(Str::slug($name));

        $category = BlogCategory::create([
            'name' => $name,
            'slug' => $slug,
            'status' => $request->boolean('status', true),
        ]);

        return response()->json([
            'status' => 1,
            'message' => 'Blog category created successfully.',
            'data' => $category,
        ], 201);
    }

    public function update(Request $request, int $id)
    {
        $forbidden = $this->ensureSuperAdmin();
        if ($forbidden) return $forbidden;

        $category = BlogCategory::find($id);
        if (!$category) {
            return response()->json([
                'status' => 0,
                'message' => 'Blog category not found.',
            ], 404);
        }

        $validator = Validator::make($request->all(), [
            'name' => ['required', 'string', 'max:191', Rule::unique('blog_categories', 'name')->ignore($id)],
            'status' => ['nullable', 'boolean'],
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 0,
                'errors' => $validator->errors()->all(),
            ], 422);
        }

        $name = trim((string) $request->input('name'));
        $slug = $this->uniqueSlug(Str::slug($name), $id);

        $category->update([
            'name' => $name,
            'slug' => $slug,
            'status' => $request->boolean('status', $category->status),
        ]);

        return response()->json([
            'status' => 1,
            'message' => 'Blog category updated successfully.',
            'data' => $category->fresh(),
        ]);
    }

    public function destroy(int $id)
    {
        $forbidden = $this->ensureSuperAdmin();
        if ($forbidden) return $forbidden;

        $category = BlogCategory::find($id);
        if (!$category) {
            return response()->json([
                'status' => 0,
                'message' => 'Blog category not found.',
            ], 404);
        }

        $category->delete();

        return response()->json([
            'status' => 1,
            'message' => 'Blog category deleted successfully.',
        ]);
    }

    private function uniqueSlug(string $base, ?int $ignoreId = null): string
    {
        $slug = $base !== '' ? $base : 'blog-category';
        $source = $slug;
        $i = 1;

        while (true) {
            $query = BlogCategory::query()->where('slug', $slug);
            if ($ignoreId !== null) $query->where('id', '!=', $ignoreId);
            if (!$query->exists()) return $slug;
            $slug = $source . '-' . $i;
            $i++;
        }
    }
}

