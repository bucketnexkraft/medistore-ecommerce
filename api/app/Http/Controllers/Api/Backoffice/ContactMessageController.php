<?php

namespace App\Http\Controllers\Api\Backoffice;

use App\Http\Controllers\Controller;
use App\Models\ContactMessage;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class ContactMessageController extends Controller
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
        if ($forbidden) return $forbidden;

        $perPage = (int) $request->input('perPage', 20);
        $page = (int) $request->input('page', 1);
        $search = trim((string) $request->input('search', ''));

        $query = ContactMessage::query();

        if ($search !== '') {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%")
                    ->orWhere('subject', 'like', "%{$search}%")
                    ->orWhere('message', 'like', "%{$search}%");
            });
        }

        $rows = $query->orderByDesc('id')->paginate($perPage, ['*'], 'page', $page);

        return response()->json([
            'status' => 1,
            'message' => 'Contact messages fetched successfully.',
            'data' => $rows->items(),
            'meta' => [
                'current_page' => $rows->currentPage(),
                'per_page' => $rows->perPage(),
                'total' => $rows->total(),
                'last_page' => $rows->lastPage(),
            ],
        ]);
    }

    public function show(int $id)
    {
        $forbidden = $this->ensureSuperAdmin();
        if ($forbidden) return $forbidden;

        $message = ContactMessage::find($id);
        if (!$message) {
            return response()->json([
                'status' => 0,
                'message' => 'Contact message not found.',
            ], 404);
        }

        return response()->json([
            'status' => 1,
            'message' => 'Contact message fetched successfully.',
            'data' => $message,
        ]);
    }

    public function destroy(int $id)
    {
        $forbidden = $this->ensureSuperAdmin();
        if ($forbidden) return $forbidden;

        $message = ContactMessage::find($id);
        if (!$message) {
            return response()->json([
                'status' => 0,
                'message' => 'Contact message not found.',
            ], 404);
        }

        $message->delete();

        return response()->json([
            'status' => 1,
            'message' => 'Contact message deleted successfully.',
        ]);
    }
}
