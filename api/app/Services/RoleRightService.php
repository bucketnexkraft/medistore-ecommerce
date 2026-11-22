<?php

namespace App\Services;

use App\Models\Right;
use App\Models\Role;
use App\Models\RoleRight;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;

class RoleRightService
{
    public function listPermissions(?string $companyId): array
    {
        $roles = Role::query()
            ->when($companyId, fn (Builder $q) => $q->where('company_id', $companyId), fn (Builder $q) => $q->whereRaw('1 = 0'))
            ->get();

        $rights = Right::withoutGlobalScopes()
            ->select(['id', 'name', 'module'])
            ->orderBy('module')
            ->orderBy('name')
            ->get();

        $permissions = RoleRight::query()
            ->when($companyId, function (Builder $q) use ($companyId) {
                $q->whereHas('role', fn (Builder $roleQuery) => $roleQuery->where('company_id', $companyId));
            }, fn (Builder $q) => $q->whereRaw('1 = 0'))
            ->get();

        return compact('roles', 'rights', 'permissions');
    }

    public function roleList(array $filters, ?string $companyId): array
    {
        $perPage = $filters['perPage'] ?? 20;
        $page = (int) ($filters['page'] ?? 1);
        $search = (string) ($filters['search'] ?? '');
        $sortField = $filters['sortField'] ?? 'created_at';
        $sortOrder = $filters['sortOrder'] ?? 'desc';

        $query = Role::with('rights')
            ->when($companyId, fn (Builder $q) => $q->where('company_id', $companyId), fn (Builder $q) => $q->whereRaw('1 = 0'));

        if ($search !== '') {
            $query->where('name', 'LIKE', "%{$search}%");
        }

        $query->orderBy($sortField, $sortOrder);

        if ($perPage === 'all') {
            $rows = $query->get();
            $data = $rows->map(fn (Role $role) => $this->formatRole($role));

            return [
                'data' => $data,
                'meta' => [
                    'current_page' => 1,
                    'per_page' => $data->count(),
                    'total' => $data->count(),
                    'last_page' => 1,
                ],
            ];
        }

        $paginator = $query->paginate((int) $perPage, ['*'], 'page', $page);
        $data = collect($paginator->items())->map(fn (Role $role) => $this->formatRole($role));

        return [
            'data' => $data,
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
                'last_page' => $paginator->lastPage(),
            ],
        ];
    }

    public function storeRole(array $payload): Role
    {
        return DB::transaction(function () use ($payload) {
            $role = new Role();
            $role->name = ucwords(strtolower($payload['name']));
            $role->save();

            $selected = array_map('intval', $payload['rights']);
            foreach (Right::withoutGlobalScopes()->get() as $right) {
                RoleRight::create([
                    'role_id' => $role->id,
                    'right_id' => $right->id,
                    'permission' => in_array((int) $right->id, $selected, true) ? 1 : 0,
                ]);
            }

            return $role;
        });
    }

    public function updateRole(array $payload, int $id): Role
    {
        return DB::transaction(function () use ($payload, $id) {
            $role = Role::findOrFail($id);

            $role->name = ucwords(strtolower($payload['name']));
            $role->save();

            if (array_key_exists('rights', $payload)) {
                $selected = array_map('intval', $payload['rights']);
                foreach (Right::withoutGlobalScopes()->get() as $right) {
                    $roleRight = RoleRight::firstOrNew([
                        'role_id' => $role->id,
                        'right_id' => $right->id,
                    ]);
                    $roleRight->permission = in_array((int) $right->id, $selected, true) ? 1 : 0;
                    $roleRight->save();
                }
            }

            return $role;
        });
    }

    public function deleteRoles(string $ids): array
    {
        return DB::transaction(function () use ($ids) {
            $roleIds = $this->parseIds($ids);
            if (empty($roleIds)) {
                return [
                    'status' => 0,
                    'message' => 'No valid role id provided.',
                    'code' => 422,
                ];
            }

            $roles = Role::whereIn('id', $roleIds)->get()->keyBy('id');
            $deletedCount = 0;

            foreach ($roleIds as $roleId) {
                $role = $roles->get($roleId);
                if (!$role) {
                    continue;
                }

                $userCount = User::where('role', $role->id)->count();
                if ($userCount > 0) {
                    return [
                        'status' => 0,
                        'message' => "Cannot delete role {$role->name}. It is assigned to one or more users.",
                        'code' => 400,
                    ];
                }

                RoleRight::where('role_id', $role->id)->delete();
                $role->delete();
                $deletedCount++;
            }

            return [
                'status' => 1,
                'message' => $deletedCount > 1 ? 'Roles deleted successfully' : 'Role deleted successfully',
                'code' => 200,
            ];
        });
    }

    public function rightList(array $filters): array
    {
        $perPage = $filters['perPage'] ?? 20;
        $page = (int) ($filters['page'] ?? 1);
        $search = (string) ($filters['search'] ?? '');
        $sortField = $filters['sortField'] ?? 'created_at';
        $sortOrder = $filters['sortOrder'] ?? 'desc';

        $query = Right::query();
        if ($search !== '') {
            $query->where(function (Builder $q) use ($search) {
                $q->where('name', 'LIKE', "%{$search}%")
                    ->orWhere('module', 'LIKE', "%{$search}%");
            });
        }

        $query->orderBy($sortField, $sortOrder);

        if ($perPage === 'all') {
            $rows = $query->get();
            $data = $rows->map(fn (Right $right) => $this->formatRight($right));

            return [
                'data' => $data,
                'meta' => [
                    'current_page' => 1,
                    'per_page' => $data->count(),
                    'total' => $data->count(),
                    'last_page' => 1,
                ],
            ];
        }

        $paginator = $query->paginate((int) $perPage, ['*'], 'page', $page);
        $data = collect($paginator->items())->map(fn (Right $right) => $this->formatRight($right));

        return [
            'data' => $data,
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
                'last_page' => $paginator->lastPage(),
            ],
        ];
    }

    public function storeRight(array $payload): Right
    {
        return DB::transaction(function () use ($payload) {
            $name = $this->normalizeRightName((string) $payload['module'], (string) $payload['name']);
            $right = Right::firstOrNew(['name' => $name]);
            $right->name = $name;
            $right->module = trim($payload['module']);
            $right->save();

            return $right;
        });
    }

    public function updateRight(array $payload, int $id): Right
    {
        return DB::transaction(function () use ($payload, $id) {
            $right = Right::findOrFail($id);
            $right->name = $this->normalizeRightName((string) $payload['module'], (string) $payload['name']);
            $right->module = trim($payload['module']);
            $right->save();

            return $right;
        });
    }

    public function rightNameExists(string $module, string $name, ?int $exceptId = null): bool
    {
        $query = Right::where('name', $this->normalizeRightName($module, $name));

        if ($exceptId !== null) {
            $query->where('id', '!=', $exceptId);
        }

        return $query->exists();
    }

    public function deleteRights(string $ids): array
    {
        return DB::transaction(function () use ($ids) {
            $rightIds = $this->parseIds($ids);
            if (empty($rightIds)) {
                return [
                    'status' => 0,
                    'message' => 'No valid right id provided.',
                    'code' => 422,
                ];
            }

            $rights = Right::whereIn('id', $rightIds)->get()->keyBy('id');
            $deletedCount = 0;

            foreach ($rightIds as $rightId) {
                $right = $rights->get($rightId);
                if (!$right) {
                    continue;
                }

                $roleRightCount = RoleRight::where('right_id', $right->id)->count();
                if ($roleRightCount > 0) {
                    return [
                        'status' => 0,
                        'message' => "Cannot delete right '{$right->name}'. It is assigned to one or more roles.",
                        'code' => 400,
                    ];
                }

                $right->delete();
                $deletedCount++;
            }

            return [
                'status' => 1,
                'message' => $deletedCount > 1 ? 'Rights deleted successfully' : 'Right deleted successfully',
                'code' => 200,
            ];
        });
    }

    protected function formatRole(Role $role): array
    {
        return [
            'id' => $role->id,
            'name' => $role->name,
            'rights' => $role->rights()->where('permission', 1)->pluck('right_id')->toArray(),
        ];
    }

    protected function formatRight(Right $right): array
    {
        return [
            'id' => $right->id,
            'name' => $right->name,
            'module' => $right->module ?? null,
        ];
    }

    private function normalizeRightName(string $module, string $name): string
    {
        $module = trim($module);
        $name = trim($name);

        if ($module !== '' && str_starts_with($name, $module . '.')) {
            $name = substr($name, strlen($module) + 1);
        }

        return $module . '.' . ltrim($name, '.');
    }

    private function parseIds(string $ids): array
    {
        return array_values(array_unique(array_filter(array_map('intval', explode(',', $ids)))));
    }
}
