<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\Api\CommissionSubscriptionService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

class CommissionSubscriptionController extends Controller
{
    public function __construct(private readonly CommissionSubscriptionService $commissionSubscriptionService)
    {
    }

    public function companyOverview(Request $request)
    {
        $result = $this->commissionSubscriptionService->getCompanyOverview(auth()->user());

        return response()->json(collect($result)->except('code')->all(), $result['code'] ?? 200);
    }

    public function companyGateways()
    {
        return response()->json([
            'status' => 1,
            'message' => 'Commission settlement gateways fetched successfully.',
            'data' => $this->commissionSubscriptionService->getAvailableSettlementGateways(),
        ]);
    }

    public function companySubmitPayment(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'gateway_id' => [
                'required',
                Rule::exists('gateways', 'id')->where(fn ($query) => $query->where('status', 1)->where('gateway_type', 'manual')),
            ],
            'payment_fields' => 'nullable',
            'payment_files' => 'nullable|array',
            'payment_files.*' => 'file|max:5120',
            'charge_ids' => 'nullable|array',
            'charge_ids.*' => 'integer',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 0,
                'errors' => $validator->messages()->all(),
            ], 422);
        }

        $result = $this->commissionSubscriptionService->submitCompanyPayment(auth()->user(), [
            ...$validator->validated(),
            'payment_files' => (array) $request->file('payment_files', []),
        ]);

        return response()->json(collect($result)->except('code')->all(), $result['code'] ?? 200);
    }
}
