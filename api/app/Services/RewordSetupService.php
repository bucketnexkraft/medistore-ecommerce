<?php
namespace App\Services;

use App\Models\RewordSetup;
use Illuminate\Support\Facades\Validator;

class RewordSetupService
{
    /**
     * Validation rules for creating/updating RewordSetup
     */
    protected function validationRules(): array
    {
        return [
            'form_date'     => 'required|date',
            'to_date'       => 'required|date|after_or_equal:form_date',
            'amount'        => 'required|numeric|min:0',
            'reword_unit'   => 'required|numeric|min:0',
            'reword_value'  => 'required|numeric|min:0',
            'redeem_type'   => 'required|string|in:cash,sale,both',
        ];
    }

    /**
     * List RewordSetups with filtering and pagination
     */
    public function list(array $filters = []): array
    {
        $query = RewordSetup::query();

        // Apply date range filter
        if (!empty($filters['dateRange'])) {
            $dateRange = explode(' to ', (string) $filters['dateRange']);
            if (count($dateRange) === 2) {
                $startDate = $dateRange[0];
                $endDate = $dateRange[1];
                $query->where('form_date', '<=', $endDate)
                      ->where('to_date', '>=', $startDate);
            }
        }

        // Apply search filter
        if (!empty($filters['search'])) {
            $search = trim((string) $filters['search']);
            $query->where(function ($q) use ($search) {
                $q->where('form_date', 'like', "%{$search}%")
                  ->orWhere('to_date', 'like', "%{$search}%")
                  ->orWhere('amount', 'like', "%{$search}%")
                  ->orWhere('reword_unit', 'like', "%{$search}%")
                  ->orWhere('reword_value', 'like', "%{$search}%")
                  ->orWhere('redeem_type', 'like', "%{$search}%");
            });
        }

        // Apply redeem type filter
        if (!empty($filters['redeemType'])) {
            $query->where('redeem_type', $filters['redeemType']);
        }

        // Pagination
        $perPage = (int) ($filters['per_page'] ?? 10); // Default to 10 items per page
        $page = (int) ($filters['page'] ?? 1);
        $rewordSetups = $query->paginate($perPage, ['*'], 'page', $page);

        return [
            'status' => 1,
            'data' => $rewordSetups->items(),
            'meta' => [
                'current_page' => $rewordSetups->currentPage(),
                'last_page' => $rewordSetups->lastPage(),
                'per_page' => $rewordSetups->perPage(),
                'total' => $rewordSetups->total(),
            ],
        ];
    }

    /**
     * Store a new RewordSetup
     */
    public function store(array $data): array
    {
        $validator = Validator::make($data, $this->validationRules());

        if ($validator->fails()) {
            return [
                'status' => 0,
                'errors' => $validator->messages()->all(),
            ];
        }

        try {
            $rewordSetup = new RewordSetup();
            $rewordSetup->fill(collect($data)->only([
                'form_date',
                'to_date',
                'amount',
                'reword_unit',
                'reword_value',
                'redeem_type',
            ])->toArray());
            $rewordSetup->save();

            return [
                'status' => 1,
                'data' => $rewordSetup,
            ];
        } catch (\Exception $e) {
            return [
                'status' => 0,
                'errors' => [$e->getMessage()],
            ];
        }
    }

    /**
     * Update existing RewordSetup by ID
     */
    public function update(array $data, $id): array
    {
        $rewordSetup = RewordSetup::firstOrNew(['id' => $id]);

        $validator = Validator::make($data, $this->validationRules());

        if ($validator->fails()) {
            return [
                'status' => 0,
                'errors' => $validator->messages()->all(),
            ];
        }

        try {
            $rewordSetup->fill(collect($data)->only([
                'form_date',
                'to_date',
                'amount',
                'reword_unit',
                'reword_value',
                'redeem_type',
            ])->toArray());
            $rewordSetup->save();

            return [
                'status' => 1,
                'data' => $rewordSetup,
            ];
        } catch (\Exception $e) {
            return [
                'status' => 0,
                'errors' => [$e->getMessage()],
            ];
        }
    }

    /**
     * Get a single RewordSetup by ID
     */
    public function singleSetup($id = null)
    {
        try {
            $rewordSetup = ($id) ? RewordSetup::findOrFail($id) : RewordSetup::first();
            return [
                'status' => 1,
                'data' => $rewordSetup,
            ];
        } catch (\Exception $e) {
            return [
                'status' => 0,
                'errors' => [$e->getMessage()],
            ];
        }
    }

    /**
     * Delete RewordSetup(s) by ID(s)
     */
    public function delete($ids): array
    {
        try {
            $ids = is_array($ids) ? $ids : [$ids];
            RewordSetup::whereIn('id', $ids)->delete();

            return [
                'status' => 1,
                'message' => 'Reward setup(s) deleted successfully',
            ];
        } catch (\Exception $e) {
            return [
                'status' => 0,
                'errors' => [$e->getMessage()],
            ];
        }
    }
}
