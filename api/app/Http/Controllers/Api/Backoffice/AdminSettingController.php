<?php

namespace App\Http\Controllers\Api\Backoffice;

use App\Http\Controllers\Controller;
use App\Services\Api\Backoffice\AdminSettingService;
use Illuminate\Http\Request;

class AdminSettingController extends Controller
{
    public function __construct(private readonly AdminSettingService $service)
    {
    }

    public function index()
    {
        return $this->service->index();
    }

    public function update(Request $request)
    {
        return $this->service->update($request);
    }
}
