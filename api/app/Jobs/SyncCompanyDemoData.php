<?php

namespace App\Jobs;

use App\Services\Api\EcommerceDemoDataSyncService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class SyncCompanyDemoData implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 2;

    public int $timeout = 600;

    public function __construct(
        public readonly int $categoryId,
        public readonly string $companyId,
    ) {
    }

    public function handle(EcommerceDemoDataSyncService $demoDataSyncService): void
    {
        $demoDataSyncService->syncForCompanyAndCategory($this->categoryId, $this->companyId);
    }
}
