<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class UserDefinedValueController extends Controller
{
    public function list(Request $request)
    {
        $companyId = Auth::user()?->company_id;
        $type = $request->input('type', 'demand_tag');
        $perPage = (int) $request->input('perPage', 20);
        $search = trim((string) $request->input('search', ''));

        $query = DB::table('user_defined_values')
            ->where('company_id', $companyId)
            ->where('type', $type);

        if ($search !== '') {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('value', 'like', "%{$search}%");
            });
        }

        $result = $query
            ->orderBy('name', 'asc')
            ->paginate($perPage);

        return response()->json([
            'status' => 1,
            'message' => 'Data fetched successfully',
            'data' => $result->items(),
            'meta' => [
                'current_page' => $result->currentPage(),
                'last_page' => $result->lastPage(),
                'per_page' => $result->perPage(),
                'total' => $result->total(),
            ],
        ], 200);
    }

    public function store(Request $request)
    {
        $companyId = Auth::user()?->company_id;
        $user = Auth::user();

        $request->validate([
            'type' => 'required|string|max:100',
            'name' => 'required|string|max:512',
            'value' => 'nullable|string|max:512',
        ]);

        $value = trim((string) $request->input('value'));
        if ($value === '') {
            $value = Str::of((string) $request->input('name'))->lower()->replace(' ', '_')->value();
        }

        $exists = DB::table('user_defined_values')
            ->where('company_id', $companyId)
            ->where('type', $request->input('type'))
            ->where('value', $value)
            ->exists();

        if ($exists) {
            return response()->json([
                'status' => 0,
                'message' => 'This value already exists for the selected type.',
            ], 422);
        }

        $id = (string) Str::uuid();
        $now = now();
        $userName = trim(($user?->first_name ?? '') . ' ' . ($user?->last_name ?? '')) ?: ($user?->name ?? null);

        DB::table('user_defined_values')->insert([
            'id' => $id,
            'ancestor_id' => $request->input('ancestor_id'),
            'company_id' => $companyId,
            'type' => $request->input('type'),
            'value' => $value,
            'name' => $request->input('name'),
            'alt_name' => $request->input('alt_name'),
            'created_by_id' => $user?->id,
            'created_by_name' => $userName,
            'created_date' => $now,
            'last_modified_by_id' => $user?->id,
            'last_modified_by_name' => $userName,
            'last_modified_date' => $now,
        ]);

        return response()->json([
            'status' => 1,
            'message' => 'Created successfully',
        ], 201);
    }

    public function update(Request $request, string $id)
    {
        $companyId = Auth::user()?->company_id;
        $user = Auth::user();

        $request->validate([
            'type' => 'required|string|max:100',
            'name' => 'required|string|max:512',
            'value' => 'nullable|string|max:512',
        ]);

        $record = DB::table('user_defined_values')
            ->where('id', $id)
            ->where('company_id', $companyId)
            ->first();

        if (!$record) {
            return response()->json([
                'status' => 0,
                'message' => 'Record not found',
            ], 404);
        }

        $value = trim((string) $request->input('value'));
        if ($value === '') {
            $value = Str::of((string) $request->input('name'))->lower()->replace(' ', '_')->value();
        }

        $exists = DB::table('user_defined_values')
            ->where('company_id', $companyId)
            ->where('type', $request->input('type'))
            ->where('value', $value)
            ->where('id', '!=', $id)
            ->exists();

        if ($exists) {
            return response()->json([
                'status' => 0,
                'message' => 'This value already exists for the selected type.',
            ], 422);
        }

        $userName = trim(($user?->first_name ?? '') . ' ' . ($user?->last_name ?? '')) ?: ($user?->name ?? null);

        DB::table('user_defined_values')
            ->where('id', $id)
            ->where('company_id', $companyId)
            ->update([
                'type' => $request->input('type'),
                'name' => $request->input('name'),
                'value' => $value,
                'alt_name' => $request->input('alt_name'),
                'last_modified_by_id' => $user?->id,
                'last_modified_by_name' => $userName,
                'last_modified_date' => now(),
            ]);

        return response()->json([
            'status' => 1,
            'message' => 'Updated successfully',
        ], 200);
    }

    public function delete(string $id)
    {
        $companyId = Auth::user()?->company_id;

        $deleted = DB::table('user_defined_values')
            ->where('id', $id)
            ->where('company_id', $companyId)
            ->delete();

        if (!$deleted) {
            return response()->json([
                'status' => 0,
                'message' => 'Record not found',
            ], 404);
        }

        return response()->json([
            'status' => 1,
            'message' => 'Deleted successfully',
        ], 200);
    }
}
