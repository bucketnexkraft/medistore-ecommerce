<?php

namespace App\Http\Controllers\Api\Backoffice;

use App\Http\Controllers\Controller;
use App\Services\Backoffice\SettingsService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class SettingsController extends Controller
{
    public function __construct(private readonly SettingsService $settingsService) {}

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

    public function index()
    {
        if ($forbidden = $this->ensureSuperAdmin()) {
            return $forbidden;
        }

        return $this->settingsService->index();
    }

    public function show(string $key)
    {
        if ($forbidden = $this->ensureSuperAdmin()) {
            return $forbidden;
        }

        return $this->settingsService->show($key);
    }

    public function update(Request $request, string $key)
    {
        if ($forbidden = $this->ensureSuperAdmin()) {
            return $forbidden;
        }

        return $this->settingsService->update($request, $key);
    }

    public function sendTestMail(Request $request)
    {
        if ($forbidden = $this->ensureSuperAdmin()) {
            return $forbidden;
        }

        return $this->settingsService->sendTestMail($request);
    }
}
