<?php

namespace App\Http\Controllers\Api\Backoffice;

use App\Http\Controllers\Controller;
use App\Http\Requests\Backoffice\UpdateGatewayRequest;
use App\Models\Currency;
use App\Models\Gateway;
use App\Services\Backoffice\GatewayService;
use Illuminate\Http\Request;

class GatewayController extends Controller
{
    public function __construct(private GatewayService $gatewayService)
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
        $forbidden = $this->ensureSuperAdmin();
        if ($forbidden) {
            return $forbidden;
        }

        $perPage = (int) $request->input('perPage', 20);
        $page = (int) $request->input('page', 1);
        $keyword = trim((string) $request->input('keyword', ''));
        $status = $request->input('status');

        $query = Gateway::query()->with('currency');

        if ($keyword !== '') {
            $query->where('name', 'like', '%' . $keyword . '%');
        }

        if ($status === 'active') {
            $query->where('status', 1);
        } elseif ($status === 'inactive') {
            $query->where('status', 0);
        }

        $data = $query->orderByDesc('created_at')->paginate($perPage, ['*'], 'page', $page);

        return response()->json([
            'status' => 1,
            'message' => 'Gateways retrieved successfully.',
            'data' => $data->items(),
            'meta' => [
                'current_page' => $data->currentPage(),
                'per_page' => $data->perPage(),
                'total' => $data->total(),
                'last_page' => $data->lastPage(),
            ],
        ], 200);
    }

    public function edit(string $id)
    {
        $forbidden = $this->ensureSuperAdmin();
        if ($forbidden) {
            return $forbidden;
        }

        $gateway = Gateway::query()->with('currency')->find($id);
        if (!$gateway) {
            return response()->json([
                'status' => 0,
                'message' => 'Gateway not found.',
            ], 404);
        }

        $currencies = Currency::query()
            ->where('is_active', 1)
            ->orderBy('code')
            ->get(['id', 'code']);

        return response()->json([
            'status' => 1,
            'message' => 'Gateway details fetched successfully.',
            'data' => [
                'gateway' => $gateway,
                'currencies' => $currencies,
            ],
        ], 200);
    }

    public function update(UpdateGatewayRequest $request, string $id)
    {
        $forbidden = $this->ensureSuperAdmin();
        if ($forbidden) {
            return $forbidden;
        }

        $gateway = Gateway::query()->find($id);
        if (!$gateway) {
            return response()->json([
                'status' => 0,
                'message' => 'Gateway not found.',
            ], 404);
        }

        $data = $request->validated();

        $parameters = $request->input('parameters');
        if (is_string($parameters)) {
            $decoded = json_decode($parameters, true);
            if (json_last_error() === JSON_ERROR_NONE) {
                $parameters = $decoded;
            }
        }

        if (is_array($parameters)) {
            foreach ($parameters as $idx => $param) {
                if (is_array($param) && array_key_exists('is_required', $param)) {
                    $parameters[$idx]['is_required'] = filter_var($param['is_required'], FILTER_VALIDATE_BOOLEAN);
                }
            }
        }

        $data['parameters'] = $parameters;
        $data['status'] = filter_var($request->input('status', 0), FILTER_VALIDATE_BOOLEAN) ? 1 : 0;

        if ($request->hasFile('image')) {
            $data['image'] = $request->file('image');
        }

        $this->gatewayService->update($gateway, $data);

        return response()->json([
            'status' => 1,
            'message' => 'Gateway updated successfully.',
            'data' => $gateway->fresh('currency'),
        ], 200);
    }
}
