<?php

namespace App\Http\Controllers\Api\Backoffice;

use App\Http\Controllers\Controller;
use App\Models\EmailTemplate;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Validator;

class EmailTemplateController extends Controller
{
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

        $query = EmailTemplate::query()->orderBy('name');

        $keyword = trim((string) $request->query('keyword', ''));
        if ($keyword !== '') {
            $query->where(function ($builder) use ($keyword) {
                $builder
                    ->where('name', 'like', '%' . $keyword . '%')
                    ->orWhere('key', 'like', '%' . $keyword . '%')
                    ->orWhere('subject', 'like', '%' . $keyword . '%');
            });
        }

        $status = $request->query('status');
        if ($status !== null && $status !== '') {
            if (in_array((string) $status, ['active', '1', 'true'], true)) {
                $query->where('status', true);
            }

            if (in_array((string) $status, ['inactive', '0', 'false'], true)) {
                $query->where('status', false);
            }
        }

        $perPage = max((int) $request->query('per_page', 20), 1);
        $templates = $query->paginate(min($perPage, 100));

        return response()->json([
            'status' => 1,
            'message' => 'Email templates fetched successfully.',
            'data' => $templates,
        ], 200);
    }

    public function show(string $id)
    {
        $forbidden = $this->ensureSuperAdmin();
        if ($forbidden) {
            return $forbidden;
        }

        $template = EmailTemplate::query()->find($id);
        if (!$template) {
            return response()->json([
                'status' => 0,
                'message' => 'Email template not found.',
            ], 404);
        }

        return response()->json([
            'status' => 1,
            'message' => 'Email template fetched successfully.',
            'data' => $template,
        ], 200);
    }

    public function update(Request $request, string $id)
    {
        $forbidden = $this->ensureSuperAdmin();
        if ($forbidden) {
            return $forbidden;
        }

        $template = EmailTemplate::query()->find($id);
        if (!$template) {
            return response()->json([
                'status' => 0,
                'message' => 'Email template not found.',
            ], 404);
        }

        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:255',
            'subject' => 'required|string|max:255',
            'body' => 'required|string',
            'status' => 'nullable|boolean',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 0,
                'errors' => $validator->messages()->all(),
            ], 422);
        }

        $payload = $validator->validated();
        if (!array_key_exists('status', $payload)) {
            $payload['status'] = $template->status;
        }

        $template->update($payload);

        return response()->json([
            'status' => 1,
            'message' => 'Email template updated successfully.',
            'data' => $template->fresh(),
        ], 200);
    }

    public function updateStatus(Request $request, string $id)
    {
        $forbidden = $this->ensureSuperAdmin();
        if ($forbidden) {
            return $forbidden;
        }

        $template = EmailTemplate::query()->find($id);
        if (!$template) {
            return response()->json([
                'status' => 0,
                'message' => 'Email template not found.',
            ], 404);
        }

        $validator = Validator::make($request->all(), [
            'status' => 'required|boolean',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 0,
                'errors' => $validator->messages()->all(),
            ], 422);
        }

        $template->update([
            'status' => (bool) $request->input('status'),
        ]);

        return response()->json([
            'status' => 1,
            'message' => 'Email template status updated successfully.',
            'data' => $template->fresh(),
        ], 200);
    }
}

