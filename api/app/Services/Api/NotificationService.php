<?php

namespace App\Services\Api;

use App\Models\User;

class NotificationService
{
    public function resolveLimit(mixed $limit): int
    {
        return max(1, min((int) $limit, 50));
    }

    public function listForUser(User $user, int $limit)
    {
        return $user->notifications()
            ->latest()
            ->limit($limit)
            ->get()
            ->map(function ($notification) {
                return [
                    'id' => $notification->id,
                    'type' => class_basename($notification->type),
                    'data' => $notification->data,
                    'read_at' => $notification->read_at,
                    'created_at' => $notification->created_at,
                ];
            })
            ->values();
    }

    public function unreadCount(User $user): int
    {
        return $user->unreadNotifications()->count();
    }

    public function markAllRead(User $user): void
    {
        $user->unreadNotifications->markAsRead();
    }
}
