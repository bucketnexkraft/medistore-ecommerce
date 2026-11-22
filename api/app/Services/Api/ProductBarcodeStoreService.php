<?php

namespace App\Services\Api;

use App\Models\ProductBarcodeStore;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

class ProductBarcodeStoreService
{
    public function list(Request $request)
    {
        $perPage = (int) $request->input('perPage', 20);
        $page = (int) $request->input('page', 1);
        $search = trim((string) $request->input('search', ''));
        $sortField = $request->input('sortField', 'created_at');
        $sortOrder = strtolower($request->input('sortOrder', 'desc')) === 'asc' ? 'asc' : 'desc';

        $allowedSortFields = ['created_at', 'date', 'invoice_no', 'barcode'];
        if (! in_array($sortField, $allowedSortFields, true)) {
            $sortField = 'created_at';
        }

        $query = ProductBarcodeStore::query()
            ->with(['product:id,name,code,thumbnail']);

        if ($search !== '') {
            $query->where(function ($q) use ($search) {
                $q->where('barcode', 'LIKE', "%{$search}%")
                    ->orWhere('invoice_no', 'LIKE', "%{$search}%")
                    ->orWhere('note', 'LIKE', "%{$search}%")
                    ->orWhereHas('product', function ($pq) use ($search) {
                        $pq->where('name', 'LIKE', "%{$search}%")
                            ->orWhere('code', 'LIKE', "%{$search}%");
                    });
            });
        }

        $query->orderBy($sortField, $sortOrder);
        $result = $query->paginate($perPage, ['*'], 'page', $page);

        $result->setCollection(
            $result->getCollection()->map(function (ProductBarcodeStore $row) {
                return [
                    'id' => $row->id,
                    'product_id' => $row->product_id,
                    'product_name' => $row->product?->name,
                    'product_code' => $row->product?->code,
                    'product_thumbnail' => $row->product?->thumbnail,
                    'invoice_no' => $row->invoice_no,
                    'note' => $row->note,
                    'date' => optional($row->date)->toDateString(),
                    'barcode' => $row->barcode,
                    'created_at' => $row->created_at,
                ];
            })
        );

        return response()->json([
            'status' => 1,
            'message' => 'Barcode list fetched successfully.',
            'data' => $result->items(),
            'meta' => [
                'current_page' => $result->currentPage(),
                'per_page' => $result->perPage(),
                'total' => $result->total(),
                'last_page' => $result->lastPage(),
            ],
            'others_data' => [],
        ], 200);
    }

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'product_id' => [
                'required',
                Rule::exists('product', 'id')->where(function ($query) {
                    $query->where('company_id', Auth::user()?->company_id);
                }),
            ],
            'invoice_no' => 'nullable|string|max:255',
            'note' => 'nullable|string',
            'date' => 'required|date',
            'barcodes' => 'required|array|min:1',
            'barcodes.*' => 'required|string|max:255',
        ]);

        $validator->after(function ($validator) use ($request) {
            $incoming = collect($request->input('barcodes', []))
                ->map(fn ($barcode) => trim((string) $barcode))
                ->filter()
                ->values();

            if ($incoming->isEmpty()) {
                $validator->errors()->add('barcodes', 'Please provide at least one barcode.');

                return;
            }

            if ($incoming->unique()->count() !== $incoming->count()) {
                $validator->errors()->add('barcodes', 'Duplicate barcodes are not allowed.');

                return;
            }

            $barcodeRegex = '/^[a-zA-Z0-9\-_\.]+$/';
            $invalid = $incoming->first(fn ($barcode) => ! preg_match($barcodeRegex, $barcode));
            if ($invalid) {
                $validator->errors()->add('barcodes', "Invalid barcode format: {$invalid}");

                return;
            }

            $companyId = Auth::user()?->company_id;
            $alreadyExists = ProductBarcodeStore::query()
                ->where('company_id', $companyId)
                ->whereIn('barcode', $incoming->all())
                ->pluck('barcode')
                ->values();

            if ($alreadyExists->isNotEmpty()) {
                $validator->errors()->add(
                    'barcodes',
                    'Barcodes already exist: '.$alreadyExists->implode(', ')
                );
            }
        });

        if ($validator->fails()) {
            return response()->json([
                'status' => 0,
                'message' => 'Validation failed.',
                'errors' => $validator->errors(),
            ], 422);
        }

        $user = Auth::user();

        DB::beginTransaction();
        try {
            $rows = collect($request->input('barcodes', []))
                ->map(fn ($barcode) => trim((string) $barcode))
                ->filter()
                ->unique()
                ->values()
                ->map(function ($barcode) use ($request, $user) {
                    return [
                        'company_id' => $user?->company_id,
                        'product_id' => $request->product_id,
                        'invoice_no' => $request->invoice_no,
                        'note' => $request->note,
                        'date' => $request->date,
                        'barcode' => $barcode,
                        'created_at' => now(),
                        'updated_at' => now(),
                    ];
                })
                ->all();

            ProductBarcodeStore::insert($rows);

            DB::commit();

            return response()->json([
                'status' => 1,
                'message' => 'Barcodes stored successfully.',
                'data' => [
                    'count' => count($rows),
                ],
            ], 200);
        } catch (\Throwable $e) {
            DB::rollBack();

            return response()->json([
                'status' => 0,
                'message' => 'Failed to store barcodes.',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    public function update(Request $request, $id)
    {
        $companyId = Auth::user()?->company_id;

        $row = ProductBarcodeStore::query()
            ->where('company_id', $companyId)
            ->where('id', $id)
            ->first();

        if (! $row) {
            return response()->json([
                'status' => 0,
                'message' => 'Barcode record not found.',
            ], 404);
        }

        $validator = Validator::make($request->all(), [
            'product_id' => [
                'required',
                Rule::exists('product', 'id')->where(function ($query) use ($companyId) {
                    $query->where('company_id', $companyId);
                }),
            ],
            'invoice_no' => 'nullable|string|max:255',
            'note' => 'nullable|string',
            'date' => 'required|date',
            'barcode' => 'required|string|max:255',
        ]);

        $validator->after(function ($validator) use ($request, $companyId, $row) {
            $barcode = trim((string) $request->input('barcode', ''));
            if ($barcode === '') {
                $validator->errors()->add('barcode', 'Barcode is required.');

                return;
            }

            $barcodeRegex = '/^[a-zA-Z0-9\-_\.]+$/';
            if (! preg_match($barcodeRegex, $barcode)) {
                $validator->errors()->add('barcode', "Invalid barcode format: {$barcode}");

                return;
            }

            $alreadyExists = ProductBarcodeStore::query()
                ->where('company_id', $companyId)
                ->where('barcode', $barcode)
                ->where('id', '!=', $row->id)
                ->exists();

            if ($alreadyExists) {
                $validator->errors()->add('barcode', 'Barcode already exists.');
            }
        });

        if ($validator->fails()) {
            return response()->json([
                'status' => 0,
                'message' => 'Validation failed.',
                'errors' => $validator->errors(),
            ], 422);
        }

        try {
            $row->product_id = $request->product_id;
            $row->invoice_no = $request->invoice_no;
            $row->note = $request->note;
            $row->date = $request->date;
            $row->barcode = trim((string) $request->barcode);
            $row->save();

            return response()->json([
                'status' => 1,
                'message' => 'Barcode record updated successfully.',
                'data' => $row,
            ], 200);
        } catch (\Throwable $e) {
            return response()->json([
                'status' => 0,
                'message' => 'Failed to update barcode record.',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    public function delete(Request $request, $id = null)
    {
        $ids = $id ? [$id] : (array) $request->input('ids', []);
        $ids = collect($ids)->filter()->unique()->values()->all();

        if (empty($ids)) {
            return response()->json([
                'status' => 0,
                'message' => 'No barcode IDs provided.',
            ], 422);
        }

        $companyId = Auth::user()?->company_id;

        DB::beginTransaction();
        try {
            $rows = ProductBarcodeStore::query()
                ->where('company_id', $companyId)
                ->whereIn('id', $ids)
                ->get(['id']);

            if ($rows->count() !== count($ids)) {
                $foundIds = $rows->pluck('id')->all();
                $missingIds = array_values(array_diff($ids, $foundIds));
                throw new \Exception('Some barcode records were not found: '.implode(', ', $missingIds));
            }

            ProductBarcodeStore::query()
                ->where('company_id', $companyId)
                ->whereIn('id', $ids)
                ->delete();

            DB::commit();

            return response()->json([
                'status' => 1,
                'message' => 'Barcode record(s) deleted successfully.',
                'data' => [
                    'deleted_count' => count($ids),
                ],
            ], 200);
        } catch (\Throwable $e) {
            DB::rollBack();

            return response()->json([
                'status' => 0,
                'message' => 'Failed to delete barcode record(s).',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    public function destroyMultiple(Request $request)
    {
        return $this->delete($request);
    }
}
