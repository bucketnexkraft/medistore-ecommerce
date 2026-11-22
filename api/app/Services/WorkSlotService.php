<?php

namespace App\Services;

use App\Models\WorkSlot;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class WorkSlotService
{
    public function list(Request $request)
    {
        $query = WorkSlot::with('user:id,first_name,last_name')
            ->orderBy('start_time', 'asc');

        if ($request->cashier_id) {
            $query->where('user_id', $request->cashier_id);
        }

        if ($request->has('overtime') && $request->overtime !== '') {
            $query->where('overtime', $request->overtime);
        }

        $perPage = $request->input('perPage', 20);
        $slots = $query->paginate($perPage);

        return [
            'data' => $slots->items(),
            'meta' => [
                'current_page' => $slots->currentPage(),
                'last_page' => $slots->lastPage(),
                'per_page' => $slots->perPage(),
                'total' => $slots->total(),
            ],
        ];
    }

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'user_id' => 'required|exists:user,id',
            'start_time' => 'required|date_format:H:i',
            'end_time' => 'required|date_format:H:i|after:start_time',
            'overtime' => 'required|boolean',
            'handover_instructions' => 'nullable|string|max:1000',
        ]);

        if ($validator->fails()) {
            return ['status' => 0, 'errors' => $validator->errors()];
        }

        $slot = WorkSlot::create($request->only([
            'user_id',
            'start_time',
            'end_time',
            'overtime',
            'handover_instructions'
        ]));

        return ['status' => 1, 'data' => $slot->load('user')];
    }

    public function update(Request $request, $id)
    {
        $slot = WorkSlot::find($id);
        if (!$slot) {
            return ['status' => 0, 'errors' => ['id' => 'Work slot not found']];
        }

        $validator = Validator::make($request->all(), [
            'user_id' => 'required|exists:user,id',
            'start_time' => 'required|date_format:H:i',
            'end_time' => 'required|date_format:H:i|after:start_time',
            'overtime' => 'required|boolean',
            'handover_instructions' => 'nullable|string|max:1000',
        ]);

        if ($validator->fails()) {
            return ['status' => 0, 'errors' => $validator->errors()];
        }

        $slot->update($request->only([
            'user_id',
            'start_time',
            'end_time',
            'overtime',
            'handover_instructions'
        ]));

        return ['status' => 1, 'data' => $slot->load('user')];
    }

    public function delete(array $ids)
    {
        $deleted = WorkSlot::whereIn('id', $ids)->delete();

        return [
            'message' => "$deleted work slot(s) deleted successfully"
        ];
    }
}
