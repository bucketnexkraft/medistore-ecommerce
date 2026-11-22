<?php

namespace App\Http\Controllers\Api\Backoffice;

use App\Http\Controllers\Controller;
use App\Models\Blog;
use App\Services\Backoffice\BlogService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Validator;

class BlogController extends Controller
{
    public function __construct(private BlogService $blogService)
    {
    }

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

    public function options()
    {
        $forbidden = $this->ensureSuperAdmin();
        if ($forbidden) return $forbidden;

        return response()->json([
            'status' => 1,
            'message' => 'Blog options fetched successfully.',
            'data' => [
                'categories' => $this->blogService->activeCategoryOptions(),
            ],
        ]);
    }

    public function index(Request $request)
    {
        $forbidden = $this->ensureSuperAdmin();
        if ($forbidden) return $forbidden;

        $rows = $this->blogService->paginate($request->all());

        return response()->json([
            'status' => 1,
            'message' => 'Blogs fetched successfully.',
            'data' => $rows->items(),
            'meta' => [
                'current_page' => $rows->currentPage(),
                'per_page' => $rows->perPage(),
                'total' => $rows->total(),
                'last_page' => $rows->lastPage(),
            ],
        ]);
    }

    public function show(int $id)
    {
        $forbidden = $this->ensureSuperAdmin();
        if ($forbidden) return $forbidden;

        $blog = Blog::query()->with('category:id,name')->find($id);
        if (!$blog) {
            return response()->json([
                'status' => 0,
                'message' => 'Blog not found.',
            ], 404);
        }

        return response()->json([
            'status' => 1,
            'message' => 'Blog fetched successfully.',
            'data' => $blog,
        ]);
    }

    public function store(Request $request)
    {
        $forbidden = $this->ensureSuperAdmin();
        if ($forbidden) return $forbidden;

        $validator = Validator::make($request->all(), $this->blogService->validationRules());

        if ($validator->fails()) {
            return response()->json([
                'status' => 0,
                'errors' => $validator->errors()->all(),
            ], 422);
        }

        $blog = $this->blogService->create($validator->validated(), (string) Auth::id());

        return response()->json([
            'status' => 1,
            'message' => 'Blog created successfully.',
            'data' => $blog,
        ], 201);
    }

    public function update(Request $request, int $id)
    {
        $forbidden = $this->ensureSuperAdmin();
        if ($forbidden) return $forbidden;

        $blog = Blog::find($id);
        if (!$blog) {
            return response()->json([
                'status' => 0,
                'message' => 'Blog not found.',
            ], 404);
        }

        $validator = Validator::make($request->all(), $this->blogService->validationRules());

        if ($validator->fails()) {
            return response()->json([
                'status' => 0,
                'errors' => $validator->errors()->all(),
            ], 422);
        }

        $blog = $this->blogService->update($blog, $validator->validated());

        return response()->json([
            'status' => 1,
            'message' => 'Blog updated successfully.',
            'data' => $blog,
        ]);
    }

    public function destroy(int $id)
    {
        $forbidden = $this->ensureSuperAdmin();
        if ($forbidden) return $forbidden;

        $blog = Blog::find($id);
        if (!$blog) {
            return response()->json([
                'status' => 0,
                'message' => 'Blog not found.',
            ], 404);
        }

        $this->blogService->delete($blog);

        return response()->json([
            'status' => 1,
            'message' => 'Blog deleted successfully.',
        ]);
    }
}
