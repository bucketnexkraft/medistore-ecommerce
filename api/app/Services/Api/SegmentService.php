<?php

namespace App\Services\Api;

use App\Helpers\Helper;
use App\Models\Segmentation;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class SegmentService
{
    public function list(): array
    {
        $segments = Segmentation::with('children', 'children.children', 'children.children.children')
            ->whereNull('ancestor_id')
            ->orderBy('ordering', 'asc')
            ->get();

        return [
            'status' => 1,
            'message' => 'Data retrieved successfully!',
            'data' => $segments,
            'all_segments' => Segmentation::orderBy('ordering', 'asc')->get(),
        ];
    }

    public function store(Request $request): array
    {
        DB::beginTransaction();

        try {
            $segmentation = new Segmentation();
            $segmentation->name = ucfirst($request->name);
            $segmentation->ancestor_id = $request->parentId;
            $segmentation->status = $request->status ? 1 : 0;
            $segmentation->save();

            Helper::insertLanguage(Segmentation::class, $segmentation->id, 'en', 'name', $segmentation->name);

            DB::commit();

            return [[
                'status' => 1,
                'message' => 'Segment created successfully',
                'data' => $segmentation,
            ], 200];
        } catch (\Exception $e) {
            DB::rollBack();

            return [[
                'status' => 0,
                'message' => 'Failed to create segment',
                'error' => $e->getMessage(),
            ], 500];
        }
    }

    public function update(Request $request, $id): array
    {
        DB::beginTransaction();

        try {
            $segmentation = Segmentation::findOrFail($id);
            $segmentation->name = ucfirst($request->name);
            $segmentation->ancestor_id = $request->parentId;
            $segmentation->status = $request->status ? 1 : 0;
            $segmentation->save();

            Helper::insertLanguage(Segmentation::class, $segmentation->id, 'en', 'name', $segmentation->name);

            DB::commit();

            return [[
                'status' => 1,
                'message' => 'Segment updated successfully',
                'data' => $segmentation,
            ], 200];
        } catch (\Exception $e) {
            DB::rollBack();

            return [[
                'status' => 0,
                'message' => 'Failed to update segment',
                'error' => $e->getMessage(),
            ], 500];
        }
    }

    public function delete($id): array
    {
        $segmentation = Segmentation::findOrFail($id);
        $segmentation->delete();

        return [
            'status' => 1,
            'message' => 'Segment deleted successfully',
        ];
    }
}
