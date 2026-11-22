<?php

namespace App\Http\Controllers\Api\Backoffice;

use App\Http\Controllers\Controller;
use App\Models\ECategory;
use App\Support\StorefrontCategorySectionCatalog;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

class ECategoryController extends Controller
{
    private function readOnlyManagedFromConfig()
    {
        return response()->json([
            'status' => 0,
            'message' => 'E-categories are managed from config and seeder data only. Create/delete is disabled.',
        ], 403);
    }

    private function ensureSuperAdmin()
    {
        $user = Auth::user();

        if (! $user || ! $user->isSuperAdmin()) {
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
        if ($forbidden) {
            return $forbidden;
        }

        $perPage = max((int) $request->input('perPage', 20), 1);
        $page = max((int) $request->input('page', 1), 1);
        $search = trim((string) $request->input('search', ''));
        $status = $request->input('status', '');
        $configuredNames = StorefrontCategorySectionCatalog::categoryNames();

        $query = ECategory::query();

        if (! empty($configuredNames)) {
            $query->whereIn('name', $configuredNames);
        }

        if ($search !== '') {
            $query->where('name', 'like', '%' . $search . '%');
        }

        if ($status !== '' && in_array((string) $status, ['0', '1'], true)) {
            $query->where('status', (bool) $status);
        }

        if (! empty($configuredNames)) {
            $ordering = implode(', ', array_map(
                fn (string $name) => DB::getPdo()->quote($name),
                $configuredNames
            ));

            $query->orderByRaw("FIELD(name, {$ordering})");
        } else {
            $query->orderByDesc('id');
        }

        $rows = $query->paginate($perPage, ['*'], 'page', $page);

        return response()->json([
            'status' => 1,
            'message' => 'E-categories fetched successfully.',
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
        return $this->readOnlyManagedFromConfig();
    }

    public function update(Request $request, int $id)
    {
        $forbidden = $this->ensureSuperAdmin();
        if ($forbidden) {
            return $forbidden;
        }

        $category = ECategory::find($id);
        if (! $category) {
            return response()->json([
                'status' => 0,
                'message' => 'E-category not found.',
            ], 404);
        }

        $category->update([
            'status' => $request->boolean('status', $category->status),
        ]);

        return response()->json([
            'status' => 1,
            'message' => 'E-category status updated successfully.',
            'data' => $category->fresh(),
        ]);
    }

    public function destroy(int $id)
    {
        return $this->readOnlyManagedFromConfig();
    }

}
