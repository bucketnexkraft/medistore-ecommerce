<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Company;
use App\Services\BackofficeCompanyService;
use App\Services\RoleRightService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

class RoleRightController extends Controller
{
    public function __construct(
        private BackofficeCompanyService $backofficeCompanyService,
        private RoleRightService $roleRightService
    ) {
    }

    public function list(Request $request)
    {
        $companyId = Auth::user()?->company_id;

        if ($companyId) {
            $company = Company::withoutGlobalScopes()->find($companyId);
            if ($company) {
                $this->backofficeCompanyService->ensureDefaultRights($company);
            }
        }

        $data = $this->roleRightService->listPermissions($companyId);

        return response()->json([
            'status' => 1,
            'message' => 'Data retrieve successful!',
            'roles' => $data['roles'],
            'rights' => $data['rights'],
            'permissions' => $data['permissions'],
        ], 200);
    }

    public function roleList(Request $request)
    {
        $data = $this->roleRightService->roleList($request->all(), Auth::user()?->company_id);

        return response()->json([
            'status' => 1,
            'message' => 'Role fetched successfully',
            'data' => $data['data'],
            'meta' => $data['meta'],
            'others_data' => [],
        ], 200);
    }

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'name' => [
                'required',
                Rule::unique('role', 'name')->where(function ($query) {
                    return $query->where('company_id', Auth::user()->company_id);
                }),
            ],
            'rights' => 'required|array',
            'rights.*' => 'integer|exists:right,id',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 0,
                'errors' => $validator->messages()->all(),
            ], 422);
        }

        try {
            $role = $this->roleRightService->storeRole($request->all());

            return response()->json([
                'status' => 1,
                'message' => 'Role created successfully',
                'data' => $role,
            ], 200);
        } catch (\Exception $e) {
            return response()->json([
                'status' => 0,
                'message' => 'Failed to create role',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    public function update(Request $request, $id)
    {
        $validator = Validator::make($request->all(), [
            'name' => [
                'required',
                Rule::unique('role', 'name')->where(function ($query) use ($id) {
                    return $query->where('company_id', Auth::user()->company_id)
                        ->where('id', '!=', $id);
                }),
            ],
            'rights' => 'sometimes|array',
            'rights.*' => 'integer|exists:right,id',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 0,
                'errors' => $validator->messages()->all(),
            ], 422);
        }

        try {
            $role = $this->roleRightService->updateRole($request->all(), (int) $id);

            return response()->json([
                'status' => 1,
                'message' => 'Role updated successfully',
                'data' => $role,
            ], 200);
        } catch (\Exception $e) {
            return response()->json([
                'status' => 0,
                'message' => 'Failed to update role',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    public function delete($id)
    {
        try {
            $result = $this->roleRightService->deleteRoles((string) $id);

            return response()->json([
                'status' => $result['status'],
                'message' => $result['message'],
            ], $result['code']);
        } catch (\Exception $e) {
            return response()->json([
                'status' => 0,
                'message' => 'Failed to delete role',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    public function rightList(Request $request)
    {
        $data = $this->roleRightService->rightList($request->all());

        return response()->json([
            'status' => 1,
            'message' => 'Right fetched successfully',
            'data' => $data['data'],
            'meta' => $data['meta'],
            'others_data' => [],
        ], 200);
    }

    public function rightStore(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'name' => 'required',
            'module' => 'required',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 0,
                'errors' => $validator->messages()->all(),
            ], 422);
        }

        try {
            if ($this->roleRightService->rightNameExists((string) $request->module, (string) $request->name)) {
                return response()->json([
                    'status' => 0,
                    'errors' => ['The name has already been taken.'],
                ], 422);
            }

            $right = $this->roleRightService->storeRight($request->all());

            return response()->json([
                'status' => 1,
                'message' => 'Right created successfully',
                'data' => $right,
            ], 200);
        } catch (\Exception $e) {
            return response()->json([
                'status' => 0,
                'message' => 'Failed to create right',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    public function rightUpdate(Request $request, $id)
    {
        $validator = Validator::make($request->all(), [
            'name' => 'required',
            'module' => 'required',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 0,
                'errors' => $validator->messages()->all(),
            ], 422);
        }

        try {
            if ($this->roleRightService->rightNameExists((string) $request->module, (string) $request->name, (int) $id)) {
                return response()->json([
                    'status' => 0,
                    'errors' => ['The name has already been taken.'],
                ], 422);
            }

            $right = $this->roleRightService->updateRight($request->all(), (int) $id);

            return response()->json([
                'status' => 1,
                'message' => 'Right updated successfully',
                'data' => $right,
            ], 200);
        } catch (\Exception $e) {
            return response()->json([
                'status' => 0,
                'message' => 'Failed to update right',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    public function rightDelete($id)
    {
        try {
            $result = $this->roleRightService->deleteRights((string) $id);

            return response()->json([
                'status' => $result['status'],
                'message' => $result['message'],
            ], $result['code']);
        } catch (\Exception $e) {
            return response()->json([
                'status' => 0,
                'message' => 'Failed to delete right',
                'error' => $e->getMessage(),
            ], 500);
        }
    }
}
