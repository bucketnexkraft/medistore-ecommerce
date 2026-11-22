<?php

namespace App\Services\Api\Backoffice;

use App\Models\Role;
use Illuminate\Support\Facades\Auth;

class RoleService
{
    public function index(): array
    {
        $user = Auth::user();
        $rolesQuery = Role::query();

        if ($user && $user->company_id) {
            $rolesQuery->where('company_id', $user->company_id);
        } else {
            $rolesQuery->whereRaw('1 = 0');
        }

        $roles = $rolesQuery->get();

        return [
            'status' => 1,
            'message' => 'Roles retrieved successfully!',
            'roles' => $roles,
        ];
    }
}
