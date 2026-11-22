<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\Api\NotificationService;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    public function __construct(private readonly NotificationService $service)
    {
    }

    public function index(Request $request)
    {
        $user = auth()->user();

        if (!$user) {
            return response()->json([
                'status' => 0,
                'message' => 'Unauthorized.',
            ], 401);
        }

        $limit = $this->service->resolveLimit($request->input('limit', 10));

        return response()->json([
            'status' => 1,
            'message' => 'Notifications fetched successfully.',
            'data' => $this->service->listForUser($user, $limit),
            'unread_count' => $this->service->unreadCount($user),
        ]);
    }

    public function markAllRead()
    {
        $user = auth()->user();

        if (!$user) {
            return response()->json([
                'status' => 0,
                'message' => 'Unauthorized.',
            ], 401);
        }

        $this->service->markAllRead($user);

        return response()->json([
            'status' => 1,
            'message' => 'All notifications marked as read.',
        ]);
    }
}

