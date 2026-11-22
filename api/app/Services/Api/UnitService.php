<?php

namespace App\Services\Api;

use App\Helpers\AuthHelper;
use App\Models\Product;
use App\Models\Unit;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

class UnitService
{
    public function list(Request $request)
    {
        $perPage = (int) $request->input('perPage', $request->input('per_page', 20));
        $page = (int) $request->input('page', 1);
        $search = trim((string) $request->input('search', ''));
        $status = $request->input('status', '');
        $baseUnit = $request->input('baseUnit', '');
        $sortField = $request->input('sortField', 'created_at');
        $sortOrder = strtolower((string) $request->input('sortOrder', 'desc')) === 'asc' ? 'asc' : 'desc';

        $allowedSortFields = ['unit_name', 'unit_code', 'base_unit', 'operation_value', 'is_active', 'created_at'];
        if (! in_array($sortField, $allowedSortFields, true)) {
            $sortField = 'created_at';
        }

        $query = $this->applyCompanyScope(Unit::query(), $request)
            ->when($search !== '', function ($query) use ($search) {
                $query->where(function ($innerQuery) use ($search) {
                    $innerQuery
                        ->where('unit_name', 'LIKE', "%{$search}%")
                        ->orWhere('unit_code', 'LIKE', "%{$search}%");
                });
            })
            ->when($status !== '' && $status !== null, function ($query) use ($status) {
                $query->where('is_active', (int) $status);
            })
            ->when($baseUnit !== '' && $baseUnit !== null, function ($query) use ($baseUnit) {
                $query->where('base_unit', (int) $baseUnit);
            })
            ->orderBy($sortField, $sortOrder);

        $units = $query->paginate($perPage, ['*'], 'page', $page);
        $baseUnitIds = collect($units->items())
            ->pluck('base_unit')
            ->filter(fn ($id) => (int) $id > 0)
            ->unique()
            ->values();

        $baseUnits = $this->applyCompanyScope(Unit::query(), $request)
            ->whereIn('id', $baseUnitIds)
            ->pluck('unit_name', 'id');

        $data = collect($units->items())->map(function (Unit $unit) use ($baseUnits) {
            $baseUnitId = (int) ($unit->base_unit ?? 0);
            $operator = $unit->operator ?: '*';
            $operationValue = (float) ($unit->operation_value ?? 1);

            return [
                'id' => $unit->id,
                'unit_code' => $unit->unit_code,
                'unit_name' => $unit->unit_name,
                'base_unit' => $baseUnitId,
                'base_unit_name' => $baseUnitId > 0 ? ($baseUnits[$baseUnitId] ?? null) : null,
                'operator' => $operator,
                'operation_value' => $operationValue,
                'conversion_text' => $baseUnitId > 0
                    ? "{$operator} {$operationValue}"
                    : 'Base unit',
                'is_active' => (int) $unit->is_active,
            ];
        });

        return response()->json([
            'status' => 1,
            'message' => 'Units fetched successfully',
            'data' => $data->toArray(),
            'meta' => [
                'current_page' => $units->currentPage(),
                'per_page' => $units->perPage(),
                'total' => $units->total(),
                'last_page' => $units->lastPage(),
            ],
            'others_data' => [
                'base_units' => $this->applyCompanyScope(Unit::query(), $request)
                    ->select('id', 'unit_name', 'unit_code')
                    ->orderBy('unit_name', 'asc')
                    ->get(),
            ],
        ], 200);
    }

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), $this->rules(null, $request));

        if ($validator->fails()) {
            return response()->json([
                'status' => 0,
                'errors' => $validator->messages()->all(),
            ], 422);
        }

        $baseUnitId = (int) $request->input('base_unit', 0);
        if ($baseUnitId > 0 && ! $this->applyCompanyScope(Unit::query(), $request)->whereKey($baseUnitId)->exists()) {
            return response()->json([
                'status' => 0,
                'errors' => ['Selected base unit is invalid.'],
            ], 422);
        }

        DB::beginTransaction();

        try {
            $unit = new Unit;
            $unit->unit_name = trim((string) $request->unit_name);
            $unit->unit_code = trim((string) $request->unit_code);
            if ($this->hasCompanyColumn()) {
                $unit->company_id = $this->resolveCompanyId($request);
            }
            $unit->base_unit = $baseUnitId;
            $unit->operator = $baseUnitId > 0 ? $request->operator : '*';
            $unit->operation_value = $baseUnitId > 0 ? $request->operation_value : 1;
            $unit->is_active = $request->boolean('is_active', true) ? 1 : 0;
            $unit->save();

            DB::commit();

            return response()->json([
                'status' => 1,
                'message' => 'Unit created successfully',
                'data' => $unit,
            ], 200);
        } catch (\Throwable $e) {
            DB::rollBack();

            return response()->json([
                'status' => 0,
                'message' => 'Failed to create unit',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    public function update(Request $request, $id)
    {
        $validator = Validator::make($request->all(), $this->rules((int) $id, $request));

        if ($validator->fails()) {
            return response()->json([
                'status' => 0,
                'errors' => $validator->messages()->all(),
            ], 422);
        }

        $unit = $this->applyCompanyScope(Unit::query(), $request)->findOrFail($id);
        $baseUnitId = (int) $request->input('base_unit', 0);

        if ($baseUnitId === (int) $unit->id) {
            return response()->json([
                'status' => 0,
                'errors' => ['A unit cannot use itself as its base unit.'],
            ], 422);
        }

        if ($baseUnitId > 0 && ! $this->applyCompanyScope(Unit::query(), $request)->whereKey($baseUnitId)->exists()) {
            return response()->json([
                'status' => 0,
                'errors' => ['Selected base unit is invalid.'],
            ], 422);
        }

        DB::beginTransaction();

        try {
            $unit->unit_name = trim((string) $request->unit_name);
            $unit->unit_code = trim((string) $request->unit_code);
            if ($this->hasCompanyColumn()) {
                $unit->company_id = $this->resolveCompanyId($request, $unit);
            }
            $unit->base_unit = $baseUnitId;
            $unit->operator = $baseUnitId > 0 ? $request->operator : '*';
            $unit->operation_value = $baseUnitId > 0 ? $request->operation_value : 1;
            $unit->is_active = $request->boolean('is_active', true) ? 1 : 0;
            $unit->save();

            DB::commit();

            return response()->json([
                'status' => 1,
                'message' => 'Unit updated successfully',
                'data' => $unit,
            ], 200);
        } catch (\Throwable $e) {
            DB::rollBack();

            return response()->json([
                'status' => 0,
                'message' => 'Failed to update unit',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    public function delete(Request $request, $id = null)
    {
        $ids = $id ? [(int) $id] : array_map('intval', (array) $request->input('ids', []));

        if (empty($ids)) {
            return response()->json([
                'status' => 0,
                'message' => 'No unit IDs provided',
            ], 422);
        }

        DB::beginTransaction();

        try {
            $blockedMessages = [];

            foreach ($ids as $unitId) {
                $unit = $this->applyCompanyScope(Unit::query(), $request)->find($unitId);
                if (! $unit) {
                    $blockedMessages[] = "Unit with ID {$unitId} was not found.";

                    continue;
                }

                if (Product::query()
                    ->where('unit_id', $unitId)
                    ->when(! $this->isSuperAdmin(), fn ($query) => $query->where('company_id', Auth::user()?->company_id))
                    ->exists()) {
                    $blockedMessages[] = "Unit \"{$unit->unit_name}\" is already assigned to one or more products.";

                    continue;
                }

                if ($this->applyCompanyScope(Unit::query(), $request)->where('base_unit', $unitId)->exists()) {
                    $blockedMessages[] = "Unit \"{$unit->unit_name}\" is being used as a base unit by another unit.";

                    continue;
                }

                $unit->delete();
            }

            if (! empty($blockedMessages)) {
                throw new \RuntimeException(implode(' ', $blockedMessages));
            }

            DB::commit();

            return response()->json([
                'status' => 1,
                'message' => 'Units deleted successfully',
            ], 200);
        } catch (\Throwable $e) {
            DB::rollBack();

            return response()->json([
                'status' => 0,
                'message' => 'Failed to delete units',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    public function updateStatus(Request $request, $id)
    {
        $request->validate([
            'is_active' => 'required|in:0,1',
        ]);

        $unit = $this->applyCompanyScope(Unit::query(), $request)->find($id);
        if (! $unit) {
            return response()->json([
                'status' => 0,
                'message' => 'Unit not found',
            ], 404);
        }

        $unit->is_active = (int) $request->is_active;
        $unit->save();

        return response()->json([
            'status' => 1,
            'message' => 'Status updated successfully',
        ], 200);
    }

    public function updateStatusMultiple(Request $request)
    {
        $request->validate([
            'ids' => 'required|array',
            'ids.*' => 'exists:units,id',
            'is_active' => 'required|in:0,1',
        ]);

        DB::beginTransaction();

        try {
            $this->applyCompanyScope(Unit::query(), $request)
                ->whereIn('id', $request->ids)
                ->update([
                    'is_active' => (int) $request->is_active,
                ]);

            DB::commit();

            return response()->json([
                'status' => 1,
                'message' => 'Statuses updated successfully',
            ], 200);
        } catch (\Throwable $e) {
            DB::rollBack();

            return response()->json([
                'status' => 0,
                'message' => 'Failed to update statuses',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    public function destroyMultiple(Request $request)
    {
        return $this->delete($request);
    }

    private function rules(?int $unitId = null, ?Request $request = null): array
    {
        $request ??= request();
        $companyId = $this->resolveCompanyId($request);
        $scopeUniqueRule = function ($rule) use ($companyId) {
            if (! $this->hasCompanyColumn()) {
                return $rule;
            }

            return $rule->where(fn ($query) => $query->where('company_id', $companyId));
        };

        return [
            'unit_name' => [
                'required',
                'max:191',
                $scopeUniqueRule(Rule::unique('units', 'unit_name')->ignore($unitId)),
            ],
            'unit_code' => [
                'required',
                'max:191',
                $scopeUniqueRule(Rule::unique('units', 'unit_code')->ignore($unitId)),
            ],
            'base_unit' => 'nullable|integer|min:0',
            'operator' => 'nullable|in:*,/',
            'operation_value' => 'nullable|numeric|gt:0',
            'is_active' => 'nullable|boolean',
        ];
    }

    private function isSuperAdmin(): bool
    {
        return AuthHelper::isSuperAdmin();
    }

    private function resolveCompanyId(Request $request, ?Unit $unit = null): ?string
    {
        if ($this->isSuperAdmin()) {
            return $request->input('company_id', $unit?->company_id);
        }

        return Auth::user()?->company_id ?? $unit?->company_id;
    }

    private function applyCompanyScope(Builder $query, Request $request, ?Unit $unit = null): Builder
    {
        if (! $this->hasCompanyColumn()) {
            return $query;
        }

        $companyId = $this->resolveCompanyId($request, $unit);

        if ($this->isSuperAdmin()) {
            return $companyId ? $query->where('company_id', $companyId) : $query;
        }

        return $query->where('company_id', $companyId);
    }

    private function hasCompanyColumn(): bool
    {
        return Schema::hasColumn('units', 'company_id');
    }
}
