<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\Api\LogViewerService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class LogViewerController extends Controller
{
    public function __construct(private readonly LogViewerService $service)
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

    public function index(Request $request)
    {
        if ($forbidden = $this->ensureSuperAdmin()) {
            return $forbidden;
        }

        return $this->service->index($request);
    }

    public function show(Request $request, $filename)
    {
        if ($forbidden = $this->ensureSuperAdmin()) {
            return $forbidden;
        }

        return $this->service->show($request, $filename);
    }

    public function download(Request $request, $filename)
    {
        if ($forbidden = $this->ensureSuperAdmin()) {
            return $forbidden;
        }

        return $this->service->download($request, $filename);
    }

    public function destroy(Request $request, $filename)
    {
        if ($forbidden = $this->ensureSuperAdmin()) {
            return $forbidden;
        }

        return $this->service->destroy($request, $filename);
    }
}
