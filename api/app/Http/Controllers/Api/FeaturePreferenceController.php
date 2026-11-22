<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\FeaturePreference\UpdateFeaturePreferenceRequest;
use App\Services\Api\FeaturePreferenceService;

class FeaturePreferenceController extends Controller
{
    public function __construct(private readonly FeaturePreferenceService $service)
    {
    }

    public function index()
    {
        [$payload, $status] = $this->service->index();
        return response()->json($payload, $status);
    }

    public function update(UpdateFeaturePreferenceRequest $request, string $code)
    {
        [$payload, $status] = $this->service->update($code, (bool) $request->boolean('is_active'));
        return response()->json($payload, $status);
    }

    public function updateGroup(UpdateFeaturePreferenceRequest $request, string $group)
    {
        [$payload, $status] = $this->service->updateGroup($group, (bool) $request->boolean('is_active'));
        return response()->json($payload, $status);
    }
}
