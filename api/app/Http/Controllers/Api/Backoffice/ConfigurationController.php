<?php

namespace App\Http\Controllers\Api\Backoffice;

use App\Http\Controllers\Controller;
use App\Models\Setting;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Validator;

class ConfigurationController extends Controller
{
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

    public function index()
    {
        $forbidden = $this->ensureSuperAdmin();
        if ($forbidden) {
            return $forbidden;
        }

        $record = Setting::query()->where('key', 'configurations')->first();
        $value = $record?->getRawOriginal('value');
        $decoded = json_decode($value ?? '{}', true);

        $fields = [
            'email_notification',
            'sms_notification',
            'user_registration',
            'strong_password',
            'maintanance_mode',
            'language',
            'email_verification',
            'sms_verification',
            'kyc_enable',
            'push_notification',
        ];

        $data = [];
        foreach ($fields as $field) {
            $data[$field] = isset($decoded[$field]) ? (int) $decoded[$field] : 0;
        }

        return response()->json([
            'status' => 1,
            'message' => 'Configurations fetched successfully.',
            'data' => $data,
        ], 200);
    }

    public function update(Request $request)
    {
        $forbidden = $this->ensureSuperAdmin();
        if ($forbidden) {
            return $forbidden;
        }

        $validator = Validator::make($request->all(), [
            'email_notification' => 'nullable|boolean',
            'sms_notification' => 'nullable|boolean',
            'user_registration' => 'nullable|boolean',
            'strong_password' => 'nullable|boolean',
            'maintanance_mode' => 'nullable|boolean',
            'language' => 'nullable|boolean',
            'email_verification' => 'nullable|boolean',
            'sms_verification' => 'nullable|boolean',
            'kyc_enable' => 'nullable|boolean',
            'push_notification' => 'nullable|boolean',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 0,
                'errors' => $validator->messages()->all(),
            ], 422);
        }

        $fields = [
            'email_notification',
            'sms_notification',
            'user_registration',
            'strong_password',
            'maintanance_mode',
            'language',
            'email_verification',
            'sms_verification',
            'kyc_enable',
            'push_notification',
        ];

        $payload = [];
        foreach ($fields as $field) {
            $payload[$field] = $request->has($field) ? (int) $request->boolean($field) : 0;
        }

        Setting::query()->updateOrCreate(
            ['key' => 'configurations'],
            ['value' => json_encode($payload), 'is_active' => 1]
        );

        return response()->json([
            'status' => 1,
            'message' => 'Configurations updated successfully.',
            'data' => $payload,
        ], 200);
    }
}

