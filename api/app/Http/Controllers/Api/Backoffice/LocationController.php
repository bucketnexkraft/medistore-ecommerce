<?php

namespace App\Http\Controllers\Api\Backoffice;

use App\Http\Controllers\Controller;
use App\Models\Location;
use App\Models\LocationHierarchy;
use Illuminate\Database\QueryException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

class LocationController extends Controller
{
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

    public function hierarchyIndex(Request $request)
    {
        if ($forbidden = $this->ensureSuperAdmin()) {
            return $forbidden;
        }

        $perPage = (int) $request->input('perPage', 20);
        $page = (int) $request->input('page', 1);
        $search = trim((string) $request->input('search', ''));
        $status = trim((string) $request->input('status', ''));

        $query = LocationHierarchy::query()->with('parentHierarchy:id,name')->withCount(['childHierarchies', 'locations']);

        if ($search !== '') {
            $query->where('name', 'like', '%' . $search . '%');
        }

        if ($status !== '' && in_array($status, ['0', '1'], true)) {
            $query->where('status', (int) $status);
        }

        $rows = $query->orderBy('name')->paginate($perPage, ['*'], 'page', $page);

        return response()->json([
            'status' => 1,
            'message' => 'Location hierarchies fetched successfully.',
            'data' => $rows->items(),
            'meta' => [
                'current_page' => $rows->currentPage(),
                'per_page' => $rows->perPage(),
                'total' => $rows->total(),
                'last_page' => $rows->lastPage(),
            ],
        ]);
    }

    public function hierarchyOptions()
    {
        if ($forbidden = $this->ensureSuperAdmin()) {
            return $forbidden;
        }

        $rows = LocationHierarchy::query()
            ->with('parentHierarchy:id,name')
            ->orderBy('name')
            ->get(['id', 'name', 'parent_hierarchy_id', 'status']);

        return response()->json([
            'status' => 1,
            'message' => 'Location hierarchy options fetched successfully.',
            'data' => $rows,
        ]);
    }

    public function hierarchyStore(Request $request)
    {
        if ($forbidden = $this->ensureSuperAdmin()) {
            return $forbidden;
        }

        $validator = Validator::make($request->all(), [
            'name' => ['required', 'string', 'max:120', Rule::unique('location_hierarchies', 'name')],
            'parent_hierarchy_id' => ['nullable', 'integer', 'exists:location_hierarchies,id'],
            'status' => ['nullable', 'boolean'],
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 0,
                'errors' => $validator->errors()->all(),
            ], 422);
        }

        $payload = $validator->validated();
        $hierarchy = LocationHierarchy::create([
            'name' => trim((string) $payload['name']),
            'parent_hierarchy_id' => $payload['parent_hierarchy_id'] ?? null,
            'status' => (bool) ($payload['status'] ?? true),
        ]);

        return response()->json([
            'status' => 1,
            'message' => 'Location hierarchy created successfully.',
            'data' => $hierarchy->load('parentHierarchy:id,name'),
        ], 201);
    }

    public function hierarchyUpdate(Request $request, int $id)
    {
        if ($forbidden = $this->ensureSuperAdmin()) {
            return $forbidden;
        }

        $hierarchy = LocationHierarchy::query()->find($id);
        if (! $hierarchy) {
            return response()->json([
                'status' => 0,
                'message' => 'Location hierarchy not found.',
            ], 404);
        }

        $validator = Validator::make($request->all(), [
            'name' => ['required', 'string', 'max:120', Rule::unique('location_hierarchies', 'name')->ignore($hierarchy->id)],
            'parent_hierarchy_id' => ['nullable', 'integer', 'exists:location_hierarchies,id', Rule::notIn([$hierarchy->id])],
            'status' => ['nullable', 'boolean'],
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 0,
                'errors' => $validator->errors()->all(),
            ], 422);
        }

        $payload = $validator->validated();
        $hierarchy->update([
            'name' => trim((string) $payload['name']),
            'parent_hierarchy_id' => $payload['parent_hierarchy_id'] ?? null,
            'status' => (bool) ($payload['status'] ?? true),
        ]);

        return response()->json([
            'status' => 1,
            'message' => 'Location hierarchy updated successfully.',
            'data' => $hierarchy->fresh()->load('parentHierarchy:id,name'),
        ]);
    }

    public function hierarchyDestroy(int $id)
    {
        if ($forbidden = $this->ensureSuperAdmin()) {
            return $forbidden;
        }

        $hierarchy = LocationHierarchy::query()->find($id);
        if (! $hierarchy) {
            return response()->json([
                'status' => 0,
                'message' => 'Location hierarchy not found.',
            ], 404);
        }

        if ($hierarchy->childHierarchies()->exists() || $hierarchy->locations()->exists()) {
            return response()->json([
                'status' => 0,
                'message' => 'This hierarchy is already in use and cannot be deleted.',
            ], 422);
        }

        try {
            $hierarchy->delete();
        } catch (QueryException) {
            return response()->json([
                'status' => 0,
                'message' => 'This hierarchy is already in use and cannot be deleted.',
            ], 422);
        }

        return response()->json([
            'status' => 1,
            'message' => 'Location hierarchy deleted successfully.',
        ]);
    }

    public function locationIndex(Request $request)
    {
        if ($forbidden = $this->ensureSuperAdmin()) {
            return $forbidden;
        }

        $perPage = (int) $request->input('perPage', 20);
        $page = (int) $request->input('page', 1);
        $search = trim((string) $request->input('search', ''));
        $status = trim((string) $request->input('status', ''));
        $hierarchyId = trim((string) $request->input('hierarchy_id', ''));
        $parentId = trim((string) $request->input('parent_id', ''));

        $query = Location::query()
            ->with(['hierarchy:id,name,parent_hierarchy_id', 'parent:id,name'])
            ->withCount('children');

        if ($search !== '') {
            $query->where('name', 'like', '%' . $search . '%');
        }

        if ($status !== '' && in_array($status, ['0', '1'], true)) {
            $query->where('status', (int) $status);
        }

        if ($hierarchyId !== '') {
            $query->where('location_hierarchy_id', (int) $hierarchyId);
        }

        if ($parentId !== '') {
            if ($parentId === 'root') {
                $query->whereNull('parent_id');
            } else {
                $query->where('parent_id', (int) $parentId);
            }
        }

        $rows = $query->orderBy('name')->paginate($perPage, ['*'], 'page', $page);

        return response()->json([
            'status' => 1,
            'message' => 'Locations fetched successfully.',
            'data' => $rows->items(),
            'meta' => [
                'current_page' => $rows->currentPage(),
                'per_page' => $rows->perPage(),
                'total' => $rows->total(),
                'last_page' => $rows->lastPage(),
            ],
        ]);
    }

    public function locationOptions(Request $request)
    {
        if ($forbidden = $this->ensureSuperAdmin()) {
            return $forbidden;
        }

        $hierarchyId = (int) $request->input('hierarchy_id');
        $excludeId = (int) $request->input('exclude_id');

        $hierarchy = LocationHierarchy::query()->find($hierarchyId);
        if (! $hierarchy) {
            return response()->json([
                'status' => 0,
                'message' => 'Location hierarchy not found.',
            ], 404);
        }

        $parentHierarchy = $hierarchy->parentHierarchy;
        $parentLocations = collect();

        if ($parentHierarchy) {
            $parentLocations = Location::query()
                ->where('location_hierarchy_id', $parentHierarchy->id)
                ->when($excludeId > 0, fn ($query) => $query->where('id', '!=', $excludeId))
                ->orderBy('name')
                ->get(['id', 'name', 'location_hierarchy_id', 'parent_id', 'status']);
        }

        return response()->json([
            'status' => 1,
            'message' => 'Location options fetched successfully.',
            'data' => [
                'hierarchy' => $hierarchy,
                'parent_hierarchy' => $parentHierarchy,
                'parent_locations' => $parentLocations,
            ],
        ]);
    }

    public function locationStore(Request $request)
    {
        if ($forbidden = $this->ensureSuperAdmin()) {
            return $forbidden;
        }

        $validator = Validator::make($request->all(), [
            'name' => ['required', 'string', 'max:160'],
            'location_hierarchy_id' => ['required', 'integer', 'exists:location_hierarchies,id'],
            'parent_id' => ['nullable', 'integer', 'exists:locations,id'],
            'status' => ['nullable', 'boolean'],
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 0,
                'errors' => $validator->errors()->all(),
            ], 422);
        }

        $payload = $validator->validated();
        $parentError = $this->validateLocationParent((int) $payload['location_hierarchy_id'], $payload['parent_id'] ?? null);
        if ($parentError) {
            return response()->json([
                'status' => 0,
                'message' => $parentError,
            ], 422);
        }

        $slug = \Illuminate\Support\Str::slug(trim((string) $payload['name']));
        $exists = Location::query()
            ->where('location_hierarchy_id', (int) $payload['location_hierarchy_id'])
            ->where('parent_id', $payload['parent_id'] ?? null)
            ->where('slug', $slug)
            ->exists();

        if ($exists) {
            return response()->json([
                'status' => 0,
                'message' => 'A location with the same name already exists under this parent.',
            ], 422);
        }

        $location = Location::create([
            'name' => trim((string) $payload['name']),
            'location_hierarchy_id' => (int) $payload['location_hierarchy_id'],
            'parent_id' => $payload['parent_id'] ?? null,
            'status' => (bool) ($payload['status'] ?? true),
        ]);

        return response()->json([
            'status' => 1,
            'message' => 'Location created successfully.',
            'data' => $location->load(['hierarchy:id,name,parent_hierarchy_id', 'parent:id,name']),
        ], 201);
    }

    public function locationUpdate(Request $request, int $id)
    {
        if ($forbidden = $this->ensureSuperAdmin()) {
            return $forbidden;
        }

        $location = Location::query()->find($id);
        if (! $location) {
            return response()->json([
                'status' => 0,
                'message' => 'Location not found.',
            ], 404);
        }

        $validator = Validator::make($request->all(), [
            'name' => ['required', 'string', 'max:160'],
            'location_hierarchy_id' => ['required', 'integer', 'exists:location_hierarchies,id'],
            'parent_id' => ['nullable', 'integer', 'exists:locations,id', Rule::notIn([$location->id])],
            'status' => ['nullable', 'boolean'],
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 0,
                'errors' => $validator->errors()->all(),
            ], 422);
        }

        $payload = $validator->validated();
        $parentError = $this->validateLocationParent((int) $payload['location_hierarchy_id'], $payload['parent_id'] ?? null);
        if ($parentError) {
            return response()->json([
                'status' => 0,
                'message' => $parentError,
            ], 422);
        }

        $slug = \Illuminate\Support\Str::slug(trim((string) $payload['name']));
        $exists = Location::query()
            ->where('location_hierarchy_id', (int) $payload['location_hierarchy_id'])
            ->where('parent_id', $payload['parent_id'] ?? null)
            ->where('slug', $slug)
            ->where('id', '!=', $location->id)
            ->exists();

        if ($exists) {
            return response()->json([
                'status' => 0,
                'message' => 'A location with the same name already exists under this parent.',
            ], 422);
        }

        $location->update([
            'name' => trim((string) $payload['name']),
            'location_hierarchy_id' => (int) $payload['location_hierarchy_id'],
            'parent_id' => $payload['parent_id'] ?? null,
            'status' => (bool) ($payload['status'] ?? true),
        ]);

        return response()->json([
            'status' => 1,
            'message' => 'Location updated successfully.',
            'data' => $location->fresh()->load(['hierarchy:id,name,parent_hierarchy_id', 'parent:id,name']),
        ]);
    }

    public function locationDestroy(int $id)
    {
        if ($forbidden = $this->ensureSuperAdmin()) {
            return $forbidden;
        }

        $location = Location::query()->find($id);
        if (! $location) {
            return response()->json([
                'status' => 0,
                'message' => 'Location not found.',
            ], 404);
        }

        if ($location->children()->exists()) {
            return response()->json([
                'status' => 0,
                'message' => 'This location has child locations and cannot be deleted.',
            ], 422);
        }

        try {
            $location->delete();
        } catch (QueryException) {
            return response()->json([
                'status' => 0,
                'message' => 'This location is already in use and cannot be deleted.',
            ], 422);
        }

        return response()->json([
            'status' => 1,
            'message' => 'Location deleted successfully.',
        ]);
    }

    private function validateLocationParent(int $hierarchyId, mixed $parentId): ?string
    {
        $hierarchy = LocationHierarchy::query()->find($hierarchyId);
        if (! $hierarchy) {
            return 'Selected hierarchy is invalid.';
        }

        if (! $hierarchy->parent_hierarchy_id && $parentId) {
            return 'This hierarchy does not allow a parent location.';
        }

        if ($hierarchy->parent_hierarchy_id && ! $parentId) {
            return 'A parent location is required for this hierarchy.';
        }

        if ($hierarchy->parent_hierarchy_id && $parentId) {
            $parentLocation = Location::query()->find($parentId);
            if (! $parentLocation) {
                return 'Selected parent location is invalid.';
            }

            if ((int) $parentLocation->location_hierarchy_id !== (int) $hierarchy->parent_hierarchy_id) {
                return 'Selected parent location does not match the required parent hierarchy.';
            }
        }

        return null;
    }
}
