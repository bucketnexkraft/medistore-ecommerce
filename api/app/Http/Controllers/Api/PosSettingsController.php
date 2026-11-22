<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\PosSettings\UpdatePosSettingsRequest;
use App\Services\Api\PosSettingsService;
use Illuminate\Http\Request;

class PosSettingsController extends Controller
{
    public function __construct(private readonly PosSettingsService $service)
    {
    }

    public function getSettings(Request $request)
    {
        return response()->json($this->service->getSettingsResponse(), 200);
    }

    public function updateSettings(UpdatePosSettingsRequest $request)
    {
        return response()->json(
            $this->service->updateSettingsResponse(
                $request->input('payment_methods', []),
                $request->input('return_policy'),
                $request->input('receipt_settings')
            ),
            200
        );
    }
}
