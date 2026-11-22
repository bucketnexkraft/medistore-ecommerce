<?php

namespace App\Http\Controllers\Api\Backoffice;

use App\Http\Controllers\Controller;
use App\Services\Api\CommissionSubscriptionService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class CommissionPaymentLogController extends Controller
{
    public function __construct(private readonly CommissionSubscriptionService $commissionSubscriptionService)
    {
    }

    private function ensureSuperAdmin()
    {
        $user = auth()->user();

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

        $logs = $this->commissionSubscriptionService->getBackofficePaymentLogs($request->all());

        return response()->json([
            'status' => 1,
            'message' => 'Commission receivables fetched successfully.',
            'data' => $logs->items(),
            'meta' => [
                'current_page' => $logs->currentPage(),
                'last_page' => $logs->lastPage(),
                'per_page' => $logs->perPage(),
                'total' => $logs->total(),
            ],
            'summary' => $this->commissionSubscriptionService->getBackofficeReceivableSummary(),
        ]);
    }

    public function updateStatus(Request $request, int $id)
    {
        if ($forbidden = $this->ensureSuperAdmin()) {
            return $forbidden;
        }

        $validator = Validator::make($request->all(), [
            'status' => 'required|in:pending,approved,rejected',
            'remarks' => 'nullable|string|max:1000',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 0,
                'errors' => $validator->messages()->all(),
            ], 422);
        }

        $result = $this->commissionSubscriptionService->updateBackofficePaymentStatus($id, $validator->validated());

        return response()->json(collect($result)->except('code')->all(), $result['code'] ?? 200);
    }

    public function sendWarning(Request $request, string $companyId)
    {
        if ($forbidden = $this->ensureSuperAdmin()) {
            return $forbidden;
        }

        $validator = Validator::make($request->all(), [
            'remarks' => 'nullable|string|max:1000',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 0,
                'errors' => $validator->messages()->all(),
            ], 422);
        }

        $result = $this->commissionSubscriptionService->sendBackofficeWarning($companyId, $validator->validated()['remarks'] ?? null);

        return response()->json(collect($result)->except('code')->all(), $result['code'] ?? 200);
    }

    public function disableStore(Request $request, string $companyId)
    {
        if ($forbidden = $this->ensureSuperAdmin()) {
            return $forbidden;
        }

        $validator = Validator::make($request->all(), [
            'remarks' => 'nullable|string|max:1000',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 0,
                'errors' => $validator->messages()->all(),
            ], 422);
        }

        $result = $this->commissionSubscriptionService->disableBackofficeCompanyStore($companyId, $validator->validated()['remarks'] ?? null);

        return response()->json(collect($result)->except('code')->all(), $result['code'] ?? 200);
    }
}
