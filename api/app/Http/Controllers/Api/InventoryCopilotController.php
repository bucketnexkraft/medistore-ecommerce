<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\Api\InventoryCopilotService;
use Illuminate\Http\Request;

class InventoryCopilotController extends Controller
{
    public function __construct(private readonly InventoryCopilotService $service)
    {
    }

    public function insights(Request $request)
    {
        $payload = $this->service->insights($request);

        return response()->json($payload, $this->resolveStatusCode($payload));
    }

    public function settings()
    {
        $payload = $this->service->settings();

        return response()->json($payload, $this->resolveStatusCode($payload));
    }

    public function updateSettings(Request $request)
    {
        $payload = $this->service->updateSettings($request);

        return response()->json($payload, $this->resolveStatusCode($payload, 200, 422));
    }

    private function resolveStatusCode(array $payload, int $successCode = 200, int $validationErrorCode = 422): int
    {
        if (!empty($payload['status'])) {
            return $successCode;
        }

        if (!empty($payload['errors'])) {
            return $validationErrorCode;
        }

        if (($payload['message'] ?? null) === 'Inventory Copilot is not enabled.') {
            return 403;
        }

        if (($payload['message'] ?? null) === 'Inventory Copilot setup table is missing. Run php artisan migrate first.') {
            return 503;
        }

        return 422;
    }
}
