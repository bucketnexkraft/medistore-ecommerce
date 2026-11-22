<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\Api\AuditLogService;
use Illuminate\Http\Request;

class AuditLogController extends Controller
{
    public function __construct(private readonly AuditLogService $service)
    {
    }

    public function index(Request $request)
    {
        return $this->service->index($request);
    }

    public function show(Request $request, int $id)
    {
        return $this->service->show($request, $id);
    }
}

