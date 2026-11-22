<?php

namespace App\Http\Controllers\Api\Backoffice;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\Backoffice\Role\IndexRoleRequest;
use App\Services\Api\Backoffice\RoleService;

class RoleController extends Controller
{
    public function __construct(private readonly RoleService $service)
    {
    }

    public function index(IndexRoleRequest $request)
    {
        return response()->json($this->service->index(), 200);
    }
}
