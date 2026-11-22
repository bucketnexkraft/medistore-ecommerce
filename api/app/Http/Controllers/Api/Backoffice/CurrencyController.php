<?php

namespace App\Http\Controllers\Api\Backoffice;

use App\Http\Controllers\Controller;
use App\Models\Currency;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Illuminate\Database\QueryException;

class CurrencyController extends Controller
{
    private function clearStorefrontCurrencyCache(): void
    {
        Cache::forget('storefront:landing-currencies:global');
        Cache::forget('storefront:landing-currencies-v2:global');
    }

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

    public function index(Request $request)
    {
        $forbidden = $this->ensureSuperAdmin();
        if ($forbidden) {
            return $forbidden;
        }

        $perPage = (int) $request->input('perPage', 20);
        $page = (int) $request->input('page', 1);
        $search = trim((string) $request->input('search', ''));
        $status = $request->input('status', '');

        $query = Currency::query();

        if ($search !== '') {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('code', 'like', "%{$search}%")
                    ->orWhere('symbol', 'like', "%{$search}%");
            });
        }

        if ($status !== '' && in_array((string) $status, ['0', '1'], true)) {
            $query->where('is_active', (int) $status);
        }

        $rows = $query->orderBy('name')->paginate($perPage, ['*'], 'page', $page);

        return response()->json([
            'status' => 1,
            'message' => 'Currencies fetched successfully.',
            'data' => $rows->items(),
            'meta' => [
                'current_page' => $rows->currentPage(),
                'per_page' => $rows->perPage(),
                'total' => $rows->total(),
                'last_page' => $rows->lastPage(),
            ],
        ]);
    }

    public function store(Request $request)
    {
        $forbidden = $this->ensureSuperAdmin();
        if ($forbidden) {
            return $forbidden;
        }

        $validator = Validator::make($request->all(), [
            'name' => ['required', 'string', 'max:191'],
            'code' => ['required', 'string', 'max:10', 'alpha', Rule::unique('currencies', 'code')],
            'symbol' => ['nullable', 'string', 'max:11'],
            'exchange_rate' => ['required', 'numeric', 'gt:0'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 0,
                'errors' => $validator->errors()->all(),
            ], 422);
        }

        $currency = Currency::create([
            'name' => $request->input('name'),
            'code' => strtoupper((string) $request->input('code')),
            'symbol' => $request->input('symbol'),
            'exchange_rate' => (float) $request->input('exchange_rate'),
            'is_active' => $request->boolean('is_active') ? 1 : 0,
        ]);

        $this->clearStorefrontCurrencyCache();

        return response()->json([
            'status' => 1,
            'message' => 'Currency created successfully.',
            'data' => $currency,
        ], 201);
    }

    public function update(Request $request, int $id)
    {
        $forbidden = $this->ensureSuperAdmin();
        if ($forbidden) {
            return $forbidden;
        }

        $currency = Currency::find($id);
        if (!$currency) {
            return response()->json([
                'status' => 0,
                'message' => 'Currency not found.',
            ], 404);
        }

        $validator = Validator::make($request->all(), [
            'name' => ['required', 'string', 'max:191'],
            'code' => ['required', 'string', 'max:10', 'alpha', Rule::unique('currencies', 'code')->ignore($id)],
            'symbol' => ['nullable', 'string', 'max:11'],
            'exchange_rate' => ['required', 'numeric', 'gt:0'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 0,
                'errors' => $validator->errors()->all(),
            ], 422);
        }

        $currency->update([
            'name' => $request->input('name'),
            'code' => strtoupper((string) $request->input('code')),
            'symbol' => $request->input('symbol'),
            'exchange_rate' => (float) $request->input('exchange_rate'),
            'is_active' => $request->boolean('is_active') ? 1 : 0,
        ]);

        $this->clearStorefrontCurrencyCache();

        return response()->json([
            'status' => 1,
            'message' => 'Currency updated successfully.',
            'data' => $currency->fresh(),
        ]);
    }

    public function destroy(Request $request, int $id)
    {
        $forbidden = $this->ensureSuperAdmin();
        if ($forbidden) {
            return $forbidden;
        }

        $currency = Currency::find($id);
        if (!$currency) {
            return response()->json([
                'status' => 0,
                'message' => 'Currency not found.',
            ], 404);
        }

        try {
            $currency->delete();
        } catch (QueryException $e) {
            return response()->json([
                'status' => 0,
                'message' => 'Currency is in use and cannot be deleted.',
            ], 422);
        }

        $this->clearStorefrontCurrencyCache();

        return response()->json([
            'status' => 1,
            'message' => 'Currency deleted successfully.',
        ]);
    }
}
