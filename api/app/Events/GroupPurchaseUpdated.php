<?php

namespace App\Events;

use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class GroupPurchaseUpdated implements ShouldBroadcastNow
{
    use Dispatchable, SerializesModels;

    public function __construct(
        public readonly string $groupId,
        public readonly array $group,
        public readonly string $action
    ) {
    }

    public function broadcastOn(): PrivateChannel
    {
        return new PrivateChannel('group-purchase.' . $this->groupId);
    }

    public function broadcastAs(): string
    {
        return 'group-purchase.updated';
    }

    public function broadcastWith(): array
    {
        return [
            'action' => $this->action,
            'group' => $this->group,
        ];
    }
}
