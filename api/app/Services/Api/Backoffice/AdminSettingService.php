<?php

namespace App\Services\Api\Backoffice;

use App\Models\Setting;
use App\Services\ImageService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class AdminSettingService
{
    private function ensureSuperAdmin(): ?JsonResponse
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

    public function index(): JsonResponse
    {
        $forbidden = $this->ensureSuperAdmin();
        if ($forbidden) {
            return $forbidden;
        }

        $settings = Setting::query()
            ->orderBy('key')
            ->get(['id', 'key', 'value', 'status']);

        return response()->json([
            'status' => 1,
            'message' => 'Admin settings fetched successfully.',
            'data' => $settings,
        ], 200);
    }

    public function update(Request $request): JsonResponse
    {
        $forbidden = $this->ensureSuperAdmin();
        if ($forbidden) {
            return $forbidden;
        }

        $data = [];

        foreach ($request->all() as $key => $val) {
            if ($request->hasFile($key)) {
                $request->validate([
                    $key => 'required|image|mimes:jpeg,png,jpg,gif,svg,webp|max:2048',
                ]);

                $data[$key] = ImageService::upload($request->file($key), 'settings', [
                    'extensions' => ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'],
                    'mime_types' => ['image/jpeg', 'image/png', 'image/gif', 'image/svg+xml', 'image/webp'],
                    'max_kb' => 2048,
                    'field' => $key,
                ]);
            }
        }

        $nonFileKeys = array_keys($request->files->all());
        $inputFields = $request->except(array_merge(['_token'], $nonFileKeys));

        foreach ($inputFields as $key => $val) {
            if (!is_array($val)) {
                $request->validate([
                    $key => 'nullable|string',
                ]);
                $data[$key] = $val;
            } else {
                $data[$key] = implode(',', $val);
            }
        }

        foreach ($data as $key => $val) {
            Setting::updateOrCreate(
                ['key' => $key],
                ['value' => $val]
            );
        }

        return response()->json([
            'status' => 1,
            'message' => 'Admin settings updated successfully.',
            'data' => $data,
        ], 200);
    }
}
