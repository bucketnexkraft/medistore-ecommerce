<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\Api\ReferralService;
use Illuminate\Http\Request;

class ReferralController extends Controller
{
    public function __construct(private readonly ReferralService $service)
    {
    }

    public function dashboard(Request $request)
    {
        $result = $this->service->dashboard($request);

        return response()->json(
            collect($result)->except('code')->all(),
            $result['code'] ?? 200
        );
    }
}
